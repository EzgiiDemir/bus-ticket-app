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

    /**
     * Return aggregated customers list.
     * Each row includes `customer_id` (MD5 of email or name) to use as stable identifier on frontend.
     */
    public function customers(Request $r)
    {
        $q = $r->query('q');

        $rows = Order::selectRaw(
            'MD5(COALESCE(passenger_email, passenger_name)) as customer_id,
                 COALESCE(passenger_name, "") as passenger_name,
                 COALESCE(passenger_email, "") as passenger_email,
                 COUNT(*) as orders,
                 COALESCE(SUM(total),0) as revenue,
                 MAX(created_at) as last_order_at'
        )
            ->where('status','paid')
            ->when($q, fn($qq)=> $qq->where(function($w) use ($q){
                $term = "%$q%";
                $w->where('passenger_name','like',$term)
                    ->orWhere('passenger_email','like',$term);
            }))
            ->groupBy(DB::raw('COALESCE(passenger_email, passenger_name)'), 'passenger_name', 'passenger_email')
            ->orderByDesc('last_order_at')
            ->get();

        return response()->json(['customers'=>$rows]);
    }

    /**
     * Return paginated orders for a specific customer.
     * $identifier can be:
     *  - MD5(...) previously returned as customer_id
     *  - raw email
     *  - raw passenger_name
     */
    public function customerOrders(Request $r, $identifier)
    {
        $decoded = urldecode($identifier);
        $per = max(1, min(200, (int)$r->query('per_page', 10)));
        $page = max(1, (int)$r->query('page', 1));

        $q = Order::with(['product:id,trip,terminal_from,terminal_to,departure_time,cost'])
            ->where('status','paid');

        if (preg_match('/^[a-f0-9]{32}$/i', $decoded)) {
            // MD5 identifier
            $q->whereRaw('MD5(COALESCE(passenger_email, passenger_name)) = ?', [$decoded]);
        } else {
            // Raw email or name
            $q->where(function($w) use ($decoded){
                $w->where('passenger_email', $decoded)
                    ->orWhere('passenger_name', $decoded);
            });
        }

        $result = $q->orderByDesc('created_at')->paginate($per, ['*'], 'page', $page);

        return response()->json($result);
    }
}
