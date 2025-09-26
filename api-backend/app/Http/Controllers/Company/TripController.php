<?php

namespace App\Http\Controllers\Company;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class TripController extends Controller
{
    public function index(Request $r)
    {
        $u = $r->user();
        if (!$u || !$u->company_id) {
            return response()->json(['status'=>false,'message'=>'Firma bulunamadı'], 404);
        }

        $q = Product::query()
            ->select([
                'products.id',
                'products.trip',
                'products.terminal_from',
                'products.terminal_to',
                'products.departure_time',
                'products.cost',
                'products.is_active',
                DB::raw('COUNT(orders.id) AS orders'),
                DB::raw('COALESCE(SUM(orders.total),0) AS revenue'),
            ])
            ->leftJoin('orders', 'orders.product_id', '=', 'products.id')
            ->where('products.company_id', $u->company_id)
            ->groupBy(
                'products.id',
                'products.trip',
                'products.terminal_from',
                'products.terminal_to',
                'products.departure_time',
                'products.cost',
                'products.is_active'
            )
            ->orderByDesc('products.departure_time');

        $perPage = (int) $r->integer('per_page', 100);
        return response()->json($q->paginate($perPage));
    }
}
