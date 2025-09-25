<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class TripController extends Controller
{
    public function index(Request $r)
    {
        $cid = $r->query('company_id');
        $q   = $r->query('q');

        $rows = Product::with(['user:id,name','Company:id,name'])
            ->when($cid, fn($qq)=>$qq->where('company_id',$cid))
            ->when($q, fn($qq)=>$qq->where(function($w) use($q){
                $w->where('trip','like',"%$q%")
                    ->orWhere('terminal_from','like',"%$q%")
                    ->orWhere('terminal_to','like',"%$q%");
            }))
            ->select('id','trip','company_id','company_name','user_id','terminal_from','terminal_to','departure_time','cost','capacity_reservation','is_active','created_at')
            ->latest()->get();

        $agg = DB::table('orders')
            ->selectRaw('product_id, COUNT(*) as orders, COALESCE(SUM(qty),0) as seats, COALESCE(SUM(total),0) as revenue')
            ->whereIn('product_id',$rows->pluck('id'))
            ->groupBy('product_id')->get()->keyBy('product_id');

        $now = Carbon::now();

        $rows->transform(function($p) use($agg,$now){
            // ---- Agg
            $a = $agg[$p->id] ?? null;
            $p->orders   = (int)($a->orders ?? 0);
            $p->seats    = (int)($a->seats ?? 0);
            $revRaw      = (float)($a->revenue ?? 0);

            // ---- Para normalizasyonu (kuruş -> TL)
            $p->cost_tl    = self::toTl($p->cost);
            $p->revenue_tl = self::toTl($revRaw);

            // ---- Kalan süre (dk ve “X saat Y dk”)
            $dep   = Carbon::parse($p->departure_time);
            $mins  = $dep->isFuture() ? $now->diffInMinutes($dep) : -$now->diffInMinutes($dep);
            $p->minutes_left = $mins;
            $p->remaining_human = self::minsToHuman($mins);

            return $p;
        });

        return response()->json(['trips'=>$rows]);
    }

    private static function toTl($v): float
    {
        if ($v === null) return 0.0;
        // integer kuruş ise ve 100'e tam bölünüyorsa TL'ye çevir
        if (is_numeric($v)) {
            $n = (float)$v;
            if ($n >= 1000 && fmod($n,100.0) === 0.0) return $n/100.0;
            return (float)$n;
        }
        return 0.0;
    }

    private static function minsToHuman(int $mins): string
    {
        if ($mins <= 0) return '—';
        $h = intdiv($mins, 60);
        $m = $mins % 60;
        if ($h > 0 && $m > 0) return "{$h} saat {$m} dk";
        if ($h > 0)           return "{$h} saat";
        return "{$m} dk";
    }
}
