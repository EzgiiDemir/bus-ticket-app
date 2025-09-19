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
        $pids = Product::where('user_id',$u->id)->pluck('id');
        $orders = Order::with(['product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'])
            ->whereIn('product_id',$pids)
            ->latest()->paginate(20);
        return response()->json($orders);
    }


    public function customers(Request $r)
    {
        $u = $r->user();
        $pids = Product::where('user_id',$u->id)->pluck('id');
// Distinct passengers by email
        $customers = Order::select('passenger_name','passenger_email','passenger_phone')
            ->whereIn('product_id',$pids)
            ->groupBy('passenger_name','passenger_email','passenger_phone')
            ->orderBy('passenger_name')
            ->paginate(20);
        return response()->json($customers);
    }
}
