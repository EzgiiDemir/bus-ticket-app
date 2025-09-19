<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Company;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function overview(Request $r)
    {
        $paid = Order::where('status','paid');

        return response()->json([
            'totals' => [
                'orders'        => (clone $paid)->count(),
                'revenue'       => (clone $paid)->sum('total'),
                'active_trips'  => Product::where('is_active',1)->count(),
                'upcoming'      => Product::where('is_active',1)->where('departure_time','>',now())->count(),
                'personnel'     => User::where('role','personnel')->count(),
                'customers'     => Order::distinct('passenger_email')->count('passenger_email'),
                'companies'     => Company::count(),
                'pending_staff' => User::where('role','personnel')->where('role_status','pending')->count(),
            ],
        ]);
    }

    public function revenueTimeseries(Request $r)
    {
        $days = max(1, (int)$r->query('range', 30));
        $from = Carbon::now()->subDays($days)->startOfDay();

        $rows = Order::selectRaw("DATE(CONVERT_TZ(created_at,'UTC','Europe/Istanbul')) as d, SUM(total) as revenue")
            ->where('status','paid')
            ->where('created_at','>=',$from)
            ->groupBy('d')
            ->orderBy('d')
            ->get();

        return response()->json(['series'=>$rows]);
    }

    public function companyBreakdown()
    {
        $rows = Order::join('products','orders.product_id','=','products.id')
            ->join('companies','products.company_id','=','companies.id')
            ->where('orders.status','paid')
            ->groupBy('companies.id','companies.name')
            ->selectRaw('companies.id, companies.name, SUM(orders.total) as revenue, COUNT(orders.id) as orders')
            ->orderByDesc('revenue')
            ->get();

        return response()->json(['companies'=>$rows]);
    }

    public function topRoutes()
    {
        $rows = Order::join('products','orders.product_id','=','products.id')
            ->where('orders.status','paid')
            ->groupBy('products.terminal_from','products.terminal_to')
            ->selectRaw('products.terminal_from, products.terminal_to, SUM(orders.qty) as seats, SUM(orders.total) as revenue')
            ->orderByDesc('seats')->limit(10)->get();

        return response()->json(['routes'=>$rows]);
    }
}
