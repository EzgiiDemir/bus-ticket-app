<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    // Yolcu kendi siparişlerini görür
    public function index(Request $request)
    {
        $orders = Order::with([
            'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
        ])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['status'=>true,'orders'=>$orders]);
    }

    // Satın alma
    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'product_id'       => 'required|exists:products,id',
            'qty'              => 'required|integer|min:1|max:10',
            'passenger_name'   => 'required|string|max:255',
            'passenger_email'  => 'required|email',
            'passenger_phone'  => 'nullable|string|max:32',
        ]);

        $product = Product::findOrFail($data['product_id']);
        if (!$product->is_active) {
            return response()->json(['status'=>false,'message'=>'Trip not available'], 422);
        }

        $order = DB::transaction(function () use ($user, $product, $data) {
            $unit  = $product->cost;
            $total = $unit * $data['qty'];

            $order = Order::create([
                'user_id'          => $user->id,
                'product_id'       => $product->id,
                'qty'              => $data['qty'],
                'unit_price'       => $unit,
                'total'            => $total,
                'passenger_name'   => $data['passenger_name'],
                'passenger_email'  => $data['passenger_email'],
                'passenger_phone'  => $data['passenger_phone'] ?? null,
                'pnr'              => strtoupper(Str::random(6)),
                'status'           => 'paid',
            ]);

            // İLK CEVAPTA ÜRÜNÜ GETİR
            $order->load([
                'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
            ]);

            return $order;
        });

        return response()->json([
            'status'=>true,
            'message'=>'Order created',
            'order'=>$order
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $order = Order::with([
            'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
        ])
            ->where('id',$id)
            ->where('user_id',$request->user()->id)
            ->first();

        if (!$order) {
            return response()->json(['status'=>false,'message'=>'Not found'],404);
        }

        return response()->json(['status'=>true,'order'=>$order]);
    }
}
