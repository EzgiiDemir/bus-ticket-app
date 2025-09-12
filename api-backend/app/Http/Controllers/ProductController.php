<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class ProductController extends Controller
{
    // Yolcu: tüm aktif seferler
    // Personel: sadece kendi seferleri
    public function index()
    {
        $user = Auth::user();

        $q = Product::query()->latest();

        if ($user && strtolower($user->role) === 'personnel') {
            $q->where('user_id', $user->id);
        } else {
            $q->where('is_active', 1);
        }

        return response()->json([
            'status' => true,
            'products' => $q->get(),
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        $data = $request->validate([
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

        $data['user_id'] = $user->id;
        $data['created_by'] = $user->name ?? (string)$user->id;
        $data['updated_by'] = $user->name ?? (string)$user->id;

        $data['departure_time'] = Carbon::createFromFormat('Y-m-d\TH:i', $data['departure_time'])->format('Y-m-d H:i:s');

        $product = Product::create($data);

        return response()->json([
            'status' => true,
            'message' => 'Product created',
            'product' => $product,
        ], 201);
    }

    public function show($id)
    {
        $user = Auth::user();

        // Yolcu hepsini görebilsin; personel sadece kendi kaydını
        $q = Product::query()->where('id', $id);
        if ($user && strtolower($user->role) === 'personnel') {
            $q->where('user_id', $user->id);
        }
        $product = $q->first();

        if (!$product) {
            return response()->json(['status' => false, 'message' => 'Not found'], 404);
        }

        return response()->json(['status' => true, 'product' => $product]);
    }

    public function update(Request $request, $id)
    {
        $user = Auth::user();

        $q = Product::query()->where('id', $id);
        if ($user && strtolower($user->role) === 'personnel') {
            $q->where('user_id', $user->id);
        }
        $product = $q->first();

        if (!$product) {
            return response()->json(['status' => false, 'message' => 'Not found'], 404);
        }

        $data = $request->validate([
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

        $data['updated_by'] = $user->name ?? (string)$user->id;

        if (isset($data['departure_time']) && $data['departure_time']) {
            $data['departure_time'] = Carbon::createFromFormat('Y-m-d\TH:i', $data['departure_time'])->format('Y-m-d H:i:s');
        }

        $product->update($data);

        return response()->json([
            'status' => true,
            'message' => 'Updated',
            'product' => $product->refresh(),
        ]);
    }

    public function destroy($id)
    {
        $user = Auth::user();

        $q = Product::query()->where('id', $id);
        if ($user && strtolower($user->role) === 'personnel') {
            $q->where('user_id', $user->id);
        }
        $product = $q->first();

        if (!$product) {
            return response()->json(['status' => false,'message' => 'Not found'], 404);
        }

        $product->delete();

        return response()->json(['status' => true,'message' => 'Deleted']);
    }


    public function publicIndex()
    {
        return response()->json([
            'status' => true,
            'products' => \App\Models\Product::query()
                ->where('is_active', 1)
                ->orderBy('departure_time')
                ->get([
                    'id','trip','company_name','terminal_from','terminal_to','departure_time','cost','is_active'
                ]),
        ]);
    }



}
