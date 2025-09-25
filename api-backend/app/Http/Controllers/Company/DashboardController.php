<?php

namespace App\Http\Controllers\Company;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;

class DashboardController extends Controller
{
    public function stats(Request $r)
    {
        $u = $r->user();
        $companyId = $u->company_id;

        // Son 30 gün siparişleri (şirket ürünleri)
        $ordersQ = Order::query()
            ->join('products','orders.product_id','=','products.id')
            ->where('products.company_id', $companyId)
            ->where('orders.created_at','>=', now()->subDays(30));

        $orders_30d  = (clone $ordersQ)->count();
        $revenue_30d = (clone $ordersQ)->sum('orders.total');

        // Aktif ve gelecekteki seferler
        $active_trips = Product::where('company_id', $companyId)
            ->where('is_active', true)
            ->where('departure_time', '>=', now())
            ->count();

        // Aktif personel sayısı
        $personnel_count = User::where('company_id', $companyId)
            ->where('role', 'personnel')
            ->where('role_status', 'active')
            ->count();

        return response()->json([
            'revenue_30d'     => (float) $revenue_30d,
            'orders_30d'      => (int) $orders_30d,
            'active_trips'    => (int) $active_trips,
            'personnel_count' => (int) $personnel_count,
        ]);
    }
}
