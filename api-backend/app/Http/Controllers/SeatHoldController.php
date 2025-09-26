<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;

class SeatHoldController extends Controller
{
    private int $holdMinutes = 5;

    /** Kalkışa minimum kaç dakika kala hold engellensin. */
    private int $lockWindowMin = 60;

    /** ---- Helpers ---- */

    /** Diziyse döndür, string JSON'sa parse et, aksi halde [] */
    private function jsonSeatsToArray(mixed $raw): array
    {
        if (is_array($raw)) return $raw;
        if (is_string($raw) && $raw !== '') {
            $j = json_decode($raw, true);
            return is_array($j) ? $j : [];
        }
        return [];
    }

    /** Satın alınmış koltukları tek listede döndür. */
    private function purchasedSeatsForProduct(int $productId): array
    {
        if (!Schema::hasTable('orders') || !Schema::hasColumn('orders', 'seats')) {
            return [];
        }

        $raw = DB::table('orders')
            ->where('product_id', $productId)
            ->pluck('seats')
            ->all();

        return collect($raw)
            ->flatMap(fn ($v) => $this->jsonSeatsToArray($v))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /** Aktif hold’ları (bitmemiş) döndür. */
    private function activeHeldSeats(int $productId, array $seats): array
    {
        return DB::table('seat_holds')
            ->where('product_id', $productId)
            ->whereIn('seat', $seats)
            ->where('expires_at', '>', now())
            ->pluck('seat')
            ->all();
    }

    /** ---- Actions ---- */

    public function store(Request $r): JsonResponse
    {
        $data = $r->validate([
            'product_id'     => ['required', 'integer', 'exists:products,id'],
            'seats'          => ['required', 'array', 'min:1', 'max:10'],
            'seats.*'        => ['string', 'max:8'],
            'reservation_id' => ['nullable', 'uuid'],
        ]);

        /** @var Product $product */
        $product = Product::query()->findOrFail($data['product_id']);

        if (!$product->is_active) {
            return response()->json(['status' => false, 'message' => 'Satış kapalı'], 422);
        }

        // Kalkışa <= lockWindowMin dk ise hold verme
        $depMs = strtotime((string) $product->departure_time) * 1000;
        if ($depMs - now()->getTimestampMs() <= $this->lockWindowMin * 60 * 1000) {
            return response()->json(['status' => false, 'message' => 'Kalkışa 1 saatten az. Hold verilemez'], 422);
        }

        $seats = collect($data['seats'])->filter()->unique()->values()->all();
        if (empty($seats)) {
            return response()->json(['status' => false, 'message' => 'Geçerli koltuk yok'], 422);
        }

        // Satın alınmış koltuk kontrolü
        $purchased = $this->purchasedSeatsForProduct($product->id);
        $alreadySold = array_values(array_intersect($seats, $purchased));
        if (!empty($alreadySold)) {
            return response()->json([
                'status'    => false,
                'message'   => 'Koltuk(lar) zaten satın alınmış: ' . implode(', ', $alreadySold),
                'conflicts' => $alreadySold,
            ], 409);
        }

        $reservation = $data['reservation_id'] ?? (string) Str::uuid();
        $expires = now()->addMinutes($this->holdMinutes);

        // Mevcut aktif hold’lar
        $activeHeld = $this->activeHeldSeats($product->id, $seats);
        if (!empty($activeHeld)) {
            return response()->json([
                'status'    => false,
                'message'   => 'Koltuk(lar) başka işlemde: ' . implode(', ', $activeHeld),
                'conflicts' => $activeHeld,
            ], 409);
        }

        // Ekleme: transaction + insertOrIgnore (unique ihlallerini sessizce atlar)
        DB::transaction(function () use ($seats, $product, $expires, $reservation, $r): void {
            $now = now();
            $rows = array_map(fn (string $s) => [
                'reservation_id' => $reservation,
                'product_id'     => $product->id,
                'seat'           => $s,
                'user_id'        => optional($r->user())->id,
                'expires_at'     => $expires,
                'created_at'     => $now,
                'updated_at'     => $now,
            ], $seats);

            DB::table('seat_holds')->insertOrIgnore($rows);
        });

        // Son kontrol: gerçekten tutulabilenler
        $nowHeld = DB::table('seat_holds')
            ->where('reservation_id', $reservation)
            ->where('product_id', $product->id)
            ->whereIn('seat', $seats)
            ->where('expires_at', '>', now())
            ->pluck('seat')
            ->all();

        $missing = array_values(array_diff($seats, $nowHeld));
        if (!empty($missing)) {
            return response()->json([
                'status'    => false,
                'message'   => 'Bazı koltuklar tutulamadı: ' . implode(', ', $missing),
                'conflicts' => $missing,
            ], 409);
        }

        return response()->json([
            'status'         => true,
            'reservation_id' => $reservation,
            'expires_at'     => $expires->toIso8601String(),
            'held'           => array_values($nowHeld),
        ], 201);
    }

    public function destroy(Request $r, string $reservation): JsonResponse
    {
        $data = $r->validate([
            'seats'   => ['sometimes', 'array', 'min:1', 'max:20'],
            'seats.*' => ['string', 'max:8'],
        ]);

        $q = DB::table('seat_holds')->where('reservation_id', $reservation);
        if (!empty($data['seats'])) {
            $q->whereIn('seat', $data['seats']);
        }

        $deleted = $q->delete();

        return response()->json(['status' => true, 'deleted' => $deleted]);
    }

    public function extend(Request $r, string $reservation): JsonResponse
    {
        $expires = now()->addMinutes($this->holdMinutes);

        DB::table('seat_holds')
            ->where('reservation_id', $reservation)
            ->where('expires_at', '>', now()->subMinutes(1)) // çoktan bitmişleri uzatma
            ->update([
                'expires_at' => $expires,
                'updated_at' => now(),
            ]);

        return response()->json(['status' => true, 'expires_at' => $expires->toIso8601String()]);
    }
}
