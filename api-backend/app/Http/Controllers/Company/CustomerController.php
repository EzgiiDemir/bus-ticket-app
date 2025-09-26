<?php

namespace App\Http\Controllers\Company;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $r)
    {
        $u = $r->user();
        if (!$u || !$u->company_id) {
            return response()->json(['status'=>false,'message'=>'Firma bulunamadı'], 404);
        }

        $q = DB::table('users')
            ->select([
                'users.id',
                'users.name',
                'users.email',
                DB::raw('COUNT(o.id) as orders'),
                DB::raw('COALESCE(SUM(o.total),0) as total'),
            ])
            ->join('orders as o', 'o.user_id', '=', 'users.id')
            ->join('products as p', 'p.id', '=', 'o.product_id')
            ->where('p.company_id', $u->company_id)
            ->groupBy('users.id','users.name','users.email');

        $sort = (string) $r->query('sort','total_desc');
        if ($sort === 'total_asc')      $q->orderBy('total','asc');
        elseif ($sort === 'orders_desc')$q->orderBy('orders','desc');
        elseif ($sort === 'orders_asc') $q->orderBy('orders','asc');
        else                            $q->orderBy('total','desc');

        $perPage = (int) $r->integer('per_page', 100);
        return response()->json($q->paginate($perPage));
    }
}
