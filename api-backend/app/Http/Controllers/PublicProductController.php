<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\SeatOverride;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PublicProductController extends Controller
{
    /** ---- Helpers ---- */

    /** Satın alınmış koltuk kodları (UPPER). order_items.seats varsa onu, yoksa orders.seats okur. */
    private function purchasedSeats(int $productId): array
    {
        try {
            if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'seats')) {
                $raw = DB::table('order_items')->where('product_id', $productId)->pluck('seats')->all();
            } elseif (Schema::hasTable('orders') && Schema::hasColumn('orders', 'seats')) {
                $raw = DB::table('orders')->where('product_id', $productId)->pluck('seats')->all();
            } else {
                return [];
            }

            return collect($raw)
                ->flatMap(fn ($v) => json_to_array($v)) // global helper (app/helpers.php)
                ->filter(fn ($s) => is_string($s) && $s !== '')
                ->map(fn ($s) => strtoupper($s))
                ->unique()
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /** Aktif hold’lu koltuk kodları (UPPER) */
    private function activeHeldSeats(int $productId): array
    {
        try {
            if (!Schema::hasTable('seat_holds')) return [];
            return collect(
                DB::table('seat_holds')
                    ->where('product_id', $productId)
                    ->where('expires_at', '>', now())
                    ->pluck('seat')
                    ->all()
            )
                ->filter(fn ($s) => is_string($s) && $s !== '')
                ->map(fn ($s) => strtoupper($s))
                ->unique()
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /** Geçerli override’lar (fault/blocked) */
    private function activeOverrides(int $productId): \Illuminate\Support\Collection
    {
        $now = now();

        return SeatOverride::query()
            ->where('product_id', $productId)
            ->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->get(['seat_code', 'type', 'label', 'reason'])
            ->map(function (SeatOverride $o) {
                $code = strtoupper((string) $o->seat_code);
                $type = $o->type; // 'fault' | 'blocked'
                return [
                    'code'   => $code,
                    'type'   => $type,
                    'label'  => $o->label ?? ($type === 'fault' ? 'Arıza' : 'Kapalı'),
                    'reason' => $o->reason,
                ];
            });
    }

    /** ---- Actions ---- */

    public function index(Request $req): JsonResponse
    {
        $q = trim((string) $req->query('q', ''));

        $products = Product::query()
            ->where('is_active', 1)
            ->when($q !== '', function ($qr) use ($q) {
                $like = '%' . str_replace(['%','_'], ['\%','\_'], $q) . '%';
                $qr->where(function ($w) use ($like) {
                    $w->where('trip', 'like', $like)
                        ->orWhere('company_name', 'like', $like)
                        ->orWhere('terminal_from', 'like', $like)
                        ->orWhere('terminal_to', 'like', $like);
                });
            })
            ->orderBy('departure_time')
            ->get([
                'id',
                'trip',
                'company_name',
                'terminal_from',
                'terminal_to',
                'departure_time',
                'cost',
                'duration',
                'bus_type',
                'note',
                'is_active',
            ]);

        return response()->json(['products' => $products]);
    }

    public function show(Product $product): JsonResponse
    {
        if (!$product->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        // seat_map
        $layout = in_array($product->bus_type, ['2+1', '2+2'], true) ? $product->bus_type : '2+1';
        $rows   = $product->seat_rows ?? 12;

        // route: cast varsa direkt, yoksa helper
        $routeRaw = $product->route ?? [];
        $route    = is_array($routeRaw) ? $routeRaw : json_to_array($routeRaw);

        // dolu koltuklar = satın alınmış + aktif hold
        $purchased = $this->purchasedSeats($product->id);
        $held      = $this->activeHeldSeats($product->id);
        $taken     = collect($purchased)->merge($held)->unique()->values();

        // override’lar
        $overrides     = $this->activeOverrides($product->id);
        $disabledCodes = $overrides->pluck('code');

        // UI alanları
        $takenSeats = $taken; // UPPER
        $blockedAll = $taken->merge($disabledCodes)->unique()->values();

        return response()->json([
            'id'                  => $product->id,
            'trip'                => $product->trip,
            'company_name'        => $product->company_name,
            'terminal_from'       => $product->terminal_from,
            'terminal_to'         => $product->terminal_to,
            'departure_time'      => $product->departure_time,
            'cost'                => $product->cost,
            'duration'            => $product->duration,
            'bus_type'            => $product->bus_type,
            'note'                => $product->note,
            'route'               => $route,
            'important_notes'     => $product->important_notes,
            'cancellation_policy' => $product->cancellation_policy,
            'seat_map'            => ['layout' => $layout, 'rows' => $rows],
            'taken_seats'         => $takenSeats->values(),
            'disabled_seats'      => $overrides->values(),
            'blocked_all'         => $blockedAll->values(),
            'is_active'           => (bool) $product->is_active,
        ]);
    }
}
