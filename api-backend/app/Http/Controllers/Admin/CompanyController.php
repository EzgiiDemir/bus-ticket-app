<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Support\Facades\DB;

class CompanyController extends Controller
{
    public function index()
    {
        $companies = Company::select('id','name','code')->orderBy('name')->get();

        $agg = DB::table('companies')
            ->leftJoin('products','products.company_id','=','companies.id')
            ->leftJoin('orders','orders.product_id','=','products.id')
            ->selectRaw('companies.id, COUNT(DISTINCT products.id) as trips, COUNT(DISTINCT products.user_id) as personnel, COALESCE(SUM(orders.total),0) as revenue')
            ->groupBy('companies.id')->get()->keyBy('id');

        $companies->transform(function($c) use ($agg){
            $a = $agg[$c->id] ?? null;
            $c->trips     = $a->trips ?? 0;
            $c->personnel = $a->personnel ?? 0;
            $c->revenue   = $a->revenue ?? 0.0;
            return $c;
        });

        return response()->json(['companies'=>$companies]);
    }
}
