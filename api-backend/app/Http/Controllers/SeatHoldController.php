<?php
namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\SeatHold;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;

class SeatHoldController extends Controller
{
    private function jsonSeatsToArray($raw): array {
        if (is_array($raw)) return $raw;
        if (is_string($raw) && $raw!=='') {
            $j = json_decode($raw,true);
            return is_array($j)? $j : [];
        }
        return [];
    }

    public function store(Request $r)
    {
        $data = $r->validate([
            'product_id'     => ['required','exists:products,id'],
            'seats'          => ['required','array','min:1','max:10'],
            'seats.*'        => ['string','max:8'],
            'reservation_id' => ['nullable','uuid'],
        ]);

        $product = Product::findOrFail($data['product_id']);
        if (!$product->is_active) {
            return response()->json(['status'=>false,'message'=>'Satış kapalı'], 422);
        }

        // kalkışa ≤60 dk ise hold verme
        $depMs = strtotime($product->departure_time) * 1000;
        if ($depMs - now()->getTimestampMs() <= 60*60*1000) {
            return response()->json(['status'=>false,'message'=>'Kalkışa 1 saatten az. Hold verilemez'], 422);
        }

        $seats = collect($data['seats'])->filter()->unique()->values()->all();

        // satın alınmış koltuk kontrolü
        $purchased = [];
        if (Schema::hasTable('orders') && Schema::hasColumn('orders','seats')) {
            $raw = DB::table('orders')->where('product_id',$product->id)->pluck('seats')->all();
            $purchased = collect($raw)->flatMap(fn($v)=>$this->jsonSeatsToArray($v))
                ->filter()->unique()->values()->all();
        }
        $alreadySold = array_values(array_intersect($seats, $purchased));
        if ($alreadySold) {
            return response()->json([
                'status'=>false,
                'message'=>'Koltuk(lar) zaten satın alınmış: '.implode(', ', $alreadySold),
                'conflicts'=>$alreadySold
            ], 409);
        }

        $reservation = $data['reservation_id'] ?? (string) Str::uuid();
        $expires = now()->addMinutes(5);

        // mevcut aktif hold’lar
        $activeHeld = DB::table('seat_holds')
            ->where('product_id',$product->id)
            ->whereIn('seat',$seats)
            ->where('expires_at','>',now())
            ->pluck('seat')->all();

        if ($activeHeld) {
            return response()->json([
                'status'=>false,
                'message'=>'Koltuk(lar) başka işlemde: '.implode(', ', $activeHeld),
                'conflicts'=>$activeHeld
            ], 409);
        }

        // ekleme
        DB::transaction(function() use ($seats,$product,$expires,$reservation,$r) {
            $rows = [];
            foreach ($seats as $s) {
                $rows[] = [
                    'reservation_id'=>$reservation,
                    'product_id'=>$product->id,
                    'seat'=>$s,
                    'user_id'=>optional($r->user())->id,
                    'expires_at'=>$expires,
                    'created_at'=>now(),
                    'updated_at'=>now(),
                ];
            }
            // unique ihlalini sessizce atla
            DB::table('seat_holds')->insertOrIgnore($rows);
        });

        // tekrar kontrol: insertOrIgnore sonucu alamıyoruz, çakışan var mı?
        $nowHeld = DB::table('seat_holds')
            ->where('reservation_id',$reservation)
            ->where('product_id',$product->id)
            ->whereIn('seat',$seats)
            ->where('expires_at','>',now())
            ->pluck('seat')->all();
        $missing = array_values(array_diff($seats, $nowHeld));
        if ($missing) {
            return response()->json([
                'status'=>false,
                'message'=>'Bazı koltuklar tutulamadı: '.implode(', ',$missing),
                'conflicts'=>$missing
            ], 409);
        }

        return response()->json([
            'status'=>true,
            'reservation_id'=>$reservation,
            'expires_at'=>$expires->toIso8601String(),
            'held'=>$nowHeld,
        ], 201);
    }

    public function destroy(Request $r, string $reservation)
    {
        $data = $r->validate([
            'seats'   => ['sometimes','array','min:1','max:20'],
            'seats.*' => ['string','max:8'],
        ]);
        $q = DB::table('seat_holds')->where('reservation_id',$reservation);
        if (!empty($data['seats'])) $q->whereIn('seat',$data['seats']);
        $deleted = $q->delete();

        return response()->json(['status'=>true,'deleted'=>$deleted]);
    }

    public function extend(Request $r, string $reservation)
    {
        $expires = now()->addMinutes(5);
        DB::table('seat_holds')
            ->where('reservation_id',$reservation)
            ->where('expires_at','>',now()->subMinutes(1))
            ->update(['expires_at'=>$expires,'updated_at'=>now()]);
        return response()->json(['status'=>true,'expires_at'=>$expires->toIso8601String()]);
    }
}
