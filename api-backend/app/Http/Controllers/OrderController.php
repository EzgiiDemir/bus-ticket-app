<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OrderController extends Controller
{
    // Auth kullanıcı kendi siparişlerini görür
    public function index(Request $r)
    {
        $u = $r->user();

        $q = \App\Models\Order::query()
            ->with(['product:id,trip,terminal_from,terminal_to,departure_time,cost'])
            ->where('user_id', $u->id)
            ->latest();

        $perPage = (int) $r->integer('per_page', 10);
        return response()->json($q->paginate($perPage));
    }
    public function store(Request $request)
    {
        global $r;
        $qty = (int)$request->input('qty', 0);

        $data = $request->validate([
            'product_id'              => ['required','exists:products,id'],
            'qty'                     => ['required','integer','min:1','max:10'],
            'seats'                   => ['required','array','size:'.$qty],
            'seats.*'                 => ['string'],
            'unit_price'=>'required|numeric|min:0',


            // yolcu
            'passenger_name'          => ['required','string','max:255'],
            'passenger_doc_type'      => ['nullable','in:tc,passport'],
            'passenger_national_id'   => ['nullable','string','max:32'],
            'passenger_passport_no'   => ['nullable','string','max:64'],
            'passenger_nationality'   => ['nullable','string','max:5'],

            // iletişim
            'passenger_email'         => ['nullable','email'],
            'passenger_phone'         => ['nullable','string','max:32'],

            // ödeme (demo; prod’da tokenize edin)
            'card_holder'             => ['required','string','max:150'],
            'card_number'             => ['required','string','min:12','max:19'],
            'card_exp'                => ['required','regex:/^\d{2}\/\d{2}$/'],
            'card_cvv'                => ['required','string','min:3','max:4'],
        ]);
        $data['user_id'] = $r->user()->id;
        $data['total']   = $data['qty'] * $data['unit_price'];
        $order = \App\Models\Order::create($data);
        $product = Product::findOrFail($data['product_id']);
        if (!$product->is_active) {
            return response()->json(['status'=>false,'message'=>'Trip not available'], 422);
        }

        // Çifte rezervasyonu engelle
        $seats = collect($data['seats'])->filter()->unique()->values()->all();

        // transaction + koltuk çakışma kontrolü
        $order = DB::transaction(function () use ($request, $product, $data, $seats) {
            // Mevcut dolu koltuklar (order_items varsa onu esas al)
            $taken = [];
            if (Schema::hasTable('order_items') && Schema::hasColumn('order_items','seats')) {
                $raw = DB::table('order_items')
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->pluck('seats')->all();
                $taken = collect($raw)
                    ->flatMap(function ($v) { // v: string|array
                        if (is_array($v)) return $v;
                        if (is_string($v) && $v!=='') {
                            $j = json_decode($v, true); return is_array($j)? $j : [];
                        }
                        return [];
                    })
                    ->filter(fn($s)=> is_string($s) && $s!=='')
                    ->unique()->values()->all();
            } elseif (Schema::hasTable('orders') && Schema::hasColumn('orders','seats')) {
                $raw = DB::table('orders')
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->pluck('seats')->all();
                $taken = collect($raw)
                    ->flatMap(function ($v) {
                        if (is_array($v)) return $v;
                        if (is_string($v) && $v!=='') {
                            $j = json_decode($v, true); return is_array($j)? $j : [];
                        }
                        return [];
                    })
                    ->filter(fn($s)=> is_string($s) && $s!=='')
                    ->unique()->values()->all();
            }

            $conflicts = array_values(array_intersect($seats, $taken));
            if (!empty($conflicts)) {
                abort(response()->json([
                    'status'=>false,
                    'message'=>'Seats already taken: '.implode(', ',$conflicts)
                ], 422));
            }

            $unit  = (float)$product->cost;
            $total = $unit * (int)$data['qty'];

            $order = Order::create([
                'user_id'               => optional($request->user())->id, // misafir null olabilir
                'product_id'            => $product->id,
                'qty'                   => $data['qty'],
                'unit_price'            => $unit,
                'total'                 => $total,
                'passenger_name'        => $data['passenger_name'],
                'passenger_doc'         => $data['passenger_doc_type'] ?? null,
                'passenger_national_id' => $data['passenger_doc_type']==='tc' ? ($data['passenger_national_id'] ?? null) : null,
                'passenger_passport_no' => $data['passenger_doc_type']==='passport' ? ($data['passenger_passport_no'] ?? null) : null,
                'passenger_nationality' => $data['passenger_nationality'] ?? 'TR',
                'passenger_email'       => $data['passenger_email'] ?? null,
                'passenger_phone'       => $data['passenger_phone'] ?? null,
                'seats'                 => $seats, // casts=array
                'pnr'                   => strtoupper(Str::random(6)),
                'status'                => 'paid',
            ]);

            // Koltuk bazlı item kayıtları
            if (Schema::hasTable('order_items')) {
                foreach ($seats as $s) {
                    DB::table('order_items')->insert([
                        'order_id'   => $order->id,
                        'product_id' => $product->id,
                        'seats'      => json_encode([$s]),
                        'qty'        => 1,
                        'price'      => $unit,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            return $order->load([
                'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
            ]);
        });

        return response()->json([
            'status'=>true,
            'message'=>'Order created',
            'order'=>$order,
            'pnr'=>$order->pnr,
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $order = Order::with([
            'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
        ])
            ->when($user, fn($q)=> $q->where('user_id', $user->id))
            ->where('id',$id)
            ->first();

        if (!$order) {
            return response()->json(['status'=>false,'message'=>'Not found'],404);
        }

        return response()->json(['status'=>true,'order'=>$order]);
    }
}
