<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PeopleController extends Controller
{
    public function personnel(Request $r)
    {
        $q  = $r->query('q');
        $cid= $r->query('company_id');

        $rows = User::with('company:id,name')
            ->where('role','personnel')
            ->when($cid, fn($qq)=>$qq->where('company_id',$cid))
            ->when($q, fn($qq)=>$qq->where(function($w) use($q){
                $w->where('name','like',"%$q%")->orWhere('email','like',"%$q%");
            }))
            ->select('id','name','email','role_status','company_id','created_at')
            ->get();

        // metrikler: sefer sayısı, toplam satış adedi ve geliri
        $stats = DB::table('products')
            ->leftJoin('orders','orders.product_id','=','products.id')
            ->selectRaw('products.user_id as uid, COUNT(DISTINCT products.id) as trips, COALESCE(SUM(orders.qty),0) as seats, COALESCE(SUM(orders.total),0) as revenue')
            ->when($cid, fn($qq)=>$qq->where('products.company_id',$cid))
            ->groupBy('products.user_id')->get()->keyBy('uid');

        $rows->transform(function($u) use($stats){
            $s = $stats[$u->id] ?? null;
            $u->trips   = $s->trips   ?? 0;
            $u->seats   = $s->seats   ?? 0;
            $u->revenue = $s->revenue ?? 0.0;
            return $u;
        });

        return response()->json(['personnel'=>$rows]);
    }

    public function customers(Request $r)
    {
        $q = $r->query('q');
        $rows = Order::selectRaw('passenger_name, passenger_email, COUNT(*) as orders, SUM(total) as revenue, MAX(created_at) as last_order_at')
            ->where('status','paid')
            ->when($q, fn($qq)=>$qq->where(function($w) use($q){
                $w->where('passenger_name','like',"%$q%")->orWhere('passenger_email','like',"%$q%");
            }))
            ->groupBy('passenger_name','passenger_email')
            ->orderByDesc('last_order_at')->get();

        return response()->json(['customers'=>$rows]);
    }
}
