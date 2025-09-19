<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class ProductController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum','personnel.active'])->only(['store','update','destroy']);
    }

    public function index()
    {
        $u = Auth::user();

        $q = Product::query()->latest();

        if ($u && $u->role === 'personnel') {
            $q->where('user_id', $u->id)
                ->when($u->company_id, fn($qq) => $qq->where('company_id', $u->company_id));
        } else {
            $q->where('is_active', 1);
        }

        return response()->json([
            'status' => true,
            'products' => $q->get(),
        ]);
    }

    public function store(Request $r)
    {
        $u = Auth::user();
        $user = Auth::user();
        if ($user->role !== 'personnel' || !$user->company_id) {
            return response()->json(['message'=>'Personel ve şirket zorunlu'], 403);
        }

        $data = $r->validate([
            'trip' => 'required|string|max:255',
            'company_name' => 'required|string|max:255',
            'terminal_from' => 'required|string|max:255',
            'terminal_to' => 'required|string|max:255',
            'departure_time' => ['required','date_format:Y-m-d\TH:i'],
            'cost' => 'required|numeric|min:0',
            'capacity_reservation' => 'required|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'note' => 'nullable|string|max:500',
        ]);

        $data += [
            'user_id'     => $u->id,
            'company_id'  => $u->company_id,
            'created_by'  => $u->name ?? (string) $u->id,
            'updated_by'  => $u->name ?? (string) $u->id,
        ];

        $data['departure_time'] = Carbon::createFromFormat('Y-m-d\TH:i', $data['departure_time'])->format('Y-m-d H:i:s');

        $product = Product::create($data);

        return response()->json(['status' => true, 'message' => 'Product created', 'product' => $product], 201);
    }

    public function show($id)
    {
        $u = Auth::user();

        $q = Product::query()->where('id', $id);
        if ($u && $u->role === 'personnel') {
            $q->where('user_id', $u->id)
                ->when($u->company_id, fn($qq) => $qq->where('company_id', $u->company_id));
        }

        $product = $q->first();
        if (!$product) return response()->json(['status'=>false,'message'=>'Not found'], 404);

        return response()->json(['status'=>true,'product'=>$product]);
    }

    public function update(Request $r, $id)
    {
        $u = Auth::user();

        $q = Product::query()->where('id', $id);
        if ($u && $u->role === 'personnel') {
            $q->where('user_id', $u->id)
                ->when($u->company_id, fn($qq) => $qq->where('company_id', $u->company_id));
        }
        $product = $q->first();
        if (!$product) return response()->json(['status'=>false,'message'=>'Not found'], 404);

        $payload = $r->validate([
            'trip' => 'sometimes|string|max:255',
            'company_name' => 'sometimes|string|max:255',
            'terminal_from' => 'sometimes|string|max:255',
            'terminal_to' => 'sometimes|string|max:255',
            'departure_time' => ['sometimes','date_format:Y-m-d\TH:i'],
            'cost' => 'sometimes|numeric|min:0',
            'capacity_reservation' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'note' => 'nullable|string|max:500',
        ]);

        if (!empty($payload['departure_time'])) {
            $payload['departure_time'] = Carbon::createFromFormat('Y-m-d\TH:i', $payload['departure_time'])->format('Y-m-d H:i:s');
        }

        // her güncellemede şirket bağını koru
        $payload['company_id'] = $u->company_id;
        $payload['updated_by'] = $u->name ?? (string) $u->id;

        $product->update($payload);

        return response()->json(['status'=>true,'message'=>'Updated','product'=>$product->refresh()]);
    }

    public function destroy($id)
    {
        $u = Auth::user();

        $q = Product::query()->where('id', $id);
        if ($u && $u->role === 'personnel') {
            $q->where('user_id', $u->id)
                ->when($u->company_id, fn($qq) => $qq->where('company_id', $u->company_id));
        }
        $product = $q->first();
        if (!$product) return response()->json(['status'=>false,'message'=>'Not found'], 404);

        $product->delete();
        return response()->json(['status'=>true,'message'=>'Deleted']);
    }

    public function publicIndex()
    {
        return response()->json([
            'status' => true,
            'products' => Product::query()
                ->where('is_active', 1)
                ->orderBy('departure_time')
                ->get(['id','trip','company_name','terminal_from','terminal_to','departure_time','cost','is_active']),
        ]);
    }
}
