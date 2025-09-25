<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\User;
use App\Models\Order;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class TripAnalyticsController extends Controller
{
    public function creator(Product $product)
    {
        $user = null;

        // 1) Direkt FK adayları
        foreach (['created_by','personnel_id','user_id','updated_by'] as $col) {
            if (Schema::hasColumn('products', $col) && !empty($product->{$col})) {
                $user = User::select('id','name','email','phone','role','created_at')->find($product->{$col});
                if ($user) break;
            }
        }

        // 2) Fallback: bu ürüne işlem yapan personel/admin (sipariş sahibi yerine rol filtreli)
        if (!$user) {
            $user = User::select('users.id','users.name','users.email','users.phone','users.role','users.created_at')
                ->whereIn('users.role', ['personnel','admin'])
                ->whereHas('orders', fn($q)=> $q->where('product_id', $product->id))
                ->orderByDesc('users.id')
                ->first();
        }

        // 3) Fallback: şirket personeli
        $company = null;
        if (Schema::hasColumn('products','company_id') && $product->company_id) {
            $company = Company::select('id','name')->find($product->company_id);
            if (!$user) {
                $user = User::select('id','name','email','phone','role','created_at')
                    ->where('role','personnel')
                    ->where('company_id', $product->company_id)
                    ->orderBy('id')
                    ->first();
            }
        }

        return response()->json([
            'id'         => $user?->id,
            'name'       => $user?->name,
            'email'      => $user?->email,
            'phone'      => $user?->phone,
            'role'       => $user?->role ?? 'personnel',
            'Company'    => $company ? ['id'=>$company->id, 'name'=>$company->name] : null,
            'created_at' => $user?->created_at,
        ]);
    }

    public function buyers(Request $req, Product $product)
    {
        $per = max(1, (int)$req->input('per_page', 10));

        $q = Order::query()
            ->where('product_id', $product->id)
            ->with(['user:id,name,email'])
            ->select(['id','pnr','qty','total','created_at','user_id']);

        if (Schema::hasColumn('orders','seat_numbers')) {
            $q->addSelect('seat_numbers');
        } elseif (Schema::hasColumn('orders','seats')) {
            $q->addSelect('seats as seat_numbers');
        }

        return response()->json(
            $q->orderByDesc('id')->paginate($per)
        );
    }
}
