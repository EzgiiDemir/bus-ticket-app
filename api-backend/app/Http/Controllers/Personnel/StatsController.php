<?php
namespace App\Http\Controllers\Personnel;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function index(Request $r)
    {
        $u = $r->user();
        $productIds = Product::where('user_id',$u->id)->pluck('id');

        $totals = Order::selectRaw('COUNT(*) as orders, COALESCE(SUM(total),0) as revenue')
            ->whereIn('product_id',$productIds)
            ->first();

        $activeTrips = Product::where('user_id',$u->id)->where('is_active',1)->count();
        $upcoming = Product::where('user_id',$u->id)->where('departure_time','>=',now())->count();

        $daily = Order::selectRaw("DATE(created_at) as d, COALESCE(SUM(total),0) as t")
            ->whereIn('product_id',$productIds)
            ->where('created_at','>=',now()->subDays(7))
            ->groupBy('d')->orderBy('d')->get();

        return response()->json([
            'orders' => (int)$totals->orders,
            'revenue' => (float)$totals->revenue,
            'active_trips' => (int)$activeTrips,
            'upcoming_trips' => (int)$upcoming,
            'daily' => $daily,
        ]);
    }
}
