<?php
namespace App\Http\Controllers\Personnel;


use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Product;


class PeopleController extends Controller
{
    public function orders(Request $r)
    {
        $u = $r->user();

        $q = \App\Models\Order::with(['product:id,trip,terminal_from,terminal_to,departure_time,cost'])
            ->whereHas('product', fn($qq)=> $qq->where('user_id',$u->id))
            ->when($r->filled('q'), function($qq) use ($r){
                $term = '%'.$r->q.'%';
                $qq->where(function($w) use ($term){
                    $w->where('pnr','like',$term)
                        ->orWhere('passenger_name','like',$term)
                        ->orWhereHas('product', function($p) use ($term){
                            $p->where('trip','like',$term)
                                ->orWhere('terminal_from','like',$term)
                                ->orWhere('terminal_to','like',$term);
                        });
                });
            })
            ->orderByDesc('created_at');

        $per = (int) $r->integer('per_page', 10);
        $per = $per > 0 && $per <= 100 ? $per : 10;

        return $q->paginate($per);
    }


    public function customers(Request $r)
    {
        $u = $r->user();

        $q = \App\Models\Order::query()
            ->whereHas('product', fn($p)=> $p->where('user_id',$u->id))
            ->select('passenger_name','passenger_email','passenger_phone')
            ->when($r->filled('q'), function($w) use ($r){
                $term = '%'.$r->q.'%';
                $w->where(function($x) use ($term){
                    $x->where('passenger_name','like',$term)
                        ->orWhere('passenger_email','like',$term)
                        ->orWhere('passenger_phone','like',$term);
                });
            })
            ->groupBy('passenger_name','passenger_email','passenger_phone')
            ->orderBy('passenger_name');

        $per = max(1, min(100, (int)$r->integer('per_page',10)));
        return $q->paginate($per);
    }
    public function ordersByProduct(\Illuminate\Http\Request $r, \App\Models\Product $product)
    {
        $u = $r->user();
        abort_unless($u->role === 'personnel', 403);
        abort_unless($product->user_id == $u->id && (!$u->company_id || $product->company_id == $u->company_id), 403);

        $perPage = max(1, (int)$r->input('per_page', 10));

        $orders = \App\Models\Order::query()
            ->where('product_id', $product->id)
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json($orders);
    }

}
