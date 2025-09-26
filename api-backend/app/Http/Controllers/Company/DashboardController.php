<?php

namespace App\Http\Controllers\Company;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;

class DashboardController extends Controller
{
    public function stats(Request $r)
    {
        $u = $r->user();
        $companyId   = $u->company_id;
        $companyName = optional($u->company)->name;
        $companyCode = optional($u->company)->code;

        // Şirkete ait ürünleri topla (company_id varsa onu, yoksa company_name / company_code)
        $productsQ = Product::query();

        if (Schema::hasColumn('products', 'company_id') && $companyId) {
            $productsQ->where('company_id', $companyId);
        } elseif (Schema::hasColumn('products', 'company_code') && $companyCode) {
            $productsQ->where('company_code', $companyCode);
        } elseif (Schema::hasColumn('products', 'company_name') && $companyName) {
            $productsQ->where('company_name', $companyName);
        } else {
            // Şema desteklemiyorsa boş set dönsün
            $productIds = collect([]);
            return response()->json([
                'revenue_30d'     => 0.0,
                'orders_30d'      => 0,
                'active_trips'    => 0,
                'personnel_count' => (int) User::where('company_id', $companyId)
                    ->where('role', 'personnel')->where('role_status', 'active')->count(),
            ]);
        }

        $productIds = $productsQ->pluck('id');

        // Son 30 gün siparişleri
        $ordersQ = Order::whereIn('product_id', $productIds)
            ->where('created_at', '>=', now()->subDays(30));

        $orders_30d  = (int) $ordersQ->count();
        $revenue_30d = (float) $ordersQ->sum('total');

        // Aktif ve gelecekteki seferler
        $activeTripsQ = Product::whereIn('id', $productIds)
            ->when(Schema::hasColumn('products','is_active'), fn($q)=> $q->where('is_active', true))
            ->when(Schema::hasColumn('products','departure_time'), fn($q)=> $q->where('departure_time', '>=', now()));
        $active_trips = (int) $activeTripsQ->count();

        // Aktif personel
        $personnel_count = (int) User::where('company_id', $companyId)
            ->where('role', 'personnel')
            ->where('role_status', 'active')
            ->count();

        return response()->json([
            'revenue_30d'     => $revenue_30d,
            'orders_30d'      => $orders_30d,
            'active_trips'    => $active_trips,
            'personnel_count' => $personnel_count,
        ]);
    }

    public function me(\Illuminate\Http\Request $r)
    {
        $u = $r->user();
        if (!$u || !$u->company_id) {
            return response()->json(['status'=>false,'message'=>'Şirket bulunamadı'], 404);
        }

        $company = \App\Models\Company::select('id','name','code')->find($u->company_id);
        if (!$company) {
            return response()->json(['status'=>false,'message'=>'Şirket bulunamadı'], 404);
        }

        // status kolonu varsa al, yoksa null/active döndür
        $status = null;
        if (\Illuminate\Support\Facades\Schema::hasColumn('companies','status')) {
            $status = \App\Models\Company::where('id',$u->company_id)->value('status');
        } else {
            $status = 'active';
        }

        $personnelCount = \App\Models\User::where('company_id',$u->company_id)
            ->where('role','personnel')
            ->where('role_status','active')
            ->count();

        return response()->json([
            'id'              => $company->id,
            'name'            => $company->name,
            'code'            => $company->code,
            'status'          => $status,
            'personnel_count' => (int) $personnelCount,
        ]);
    }

}
