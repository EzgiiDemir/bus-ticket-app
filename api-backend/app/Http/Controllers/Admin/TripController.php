<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TripController extends Controller
{
    public function index(Request $r)
    {
        $cid = $r->query('company_id');
        $q   = $r->query('q');

        $rows = Product::with(['user:id,name','company:id,name'])
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

        $rows->transform(function($p) use($agg){
            $a = $agg[$p->id] ?? null;
            $p->orders  = $a->orders ?? 0;
            $p->seats   = $a->seats ?? 0;
            $p->revenue = $a->revenue ?? 0.0;
            return $p;
        });

        return response()->json(['trips'=>$rows]);
    }
}
