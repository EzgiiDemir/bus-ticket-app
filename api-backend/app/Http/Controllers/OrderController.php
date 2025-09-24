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
        $data = $request->validate([
            'product_id'            => ['required','exists:products,id'],
            'qty'                   => ['required','integer','min:1','max:10'],
            'seats'                 => ['required','array','min:1','max:10'],
            'seats.*'               => ['string'],
            'reservation_id'        => ['nullable','uuid'],

            'unit_price'            => ['nullable','numeric'],

            'passenger_name'        => ['required','string','max:255'],
            'passenger_doc_type'    => ['nullable','in:tc,passport'],
            'passenger_national_id' => ['nullable','string','max:32'],
            'passenger_passport_no' => ['nullable','string','max:64'],
            'passenger_nationality' => ['nullable','string','max:5'],

            'passenger_email'       => ['nullable','email'],
            'passenger_phone'       => ['nullable','string','max:32'],

            'card_holder'           => ['required','string','max:150'],
            'card_number'           => ['required','string','min:10','max:25'],
            'card_exp'              => ['required','string'],
            'card_cvv'              => ['required','string','min:3','max:4'],
        ]);

        $product = Product::findOrFail($data['product_id']);
        if (!$product->is_active) {
            return response()->json(['status'=>false,'message'=>'Trip not available'], 422);
        }

        // Koltukları normalize et
        $seats = collect($data['seats'] ?? [])->filter()->unique()->values()->all();
        if (count($seats) < 1) {
            return response()->json(['status'=>false,'message'=>'En az 1 koltuk seçiniz.'], 422);
        }
        if (count($seats) > 10) {
            return response()->json(['status'=>false,'message'=>'Maksimum 10 koltuk seçilebilir.'], 422);
        }
        if ((int)$data['qty'] !== count($seats)) {
            return response()->json(['status'=>false,'message'=>'Adet ile koltuk sayısı eşleşmiyor.'], 422);
        }

        $order = DB::transaction(function () use ($request, $product, $data, $seats) {
            // 1) Aktif hold çatışması
            $conflictHolds = DB::table('seat_holds')
                ->where('product_id', $product->id)
                ->whereIn('seat', $seats)
                ->where('expires_at', '>', now())
                ->when($data['reservation_id'] ?? null, function ($q) use ($data) {
                    $q->where('reservation_id', '<>', $data['reservation_id']);
                })
                ->lockForUpdate()
                ->pluck('seat')->all();

            if (!empty($conflictHolds)) {
                abort(response()->json([
                    'status'    => false,
                    'message'   => 'Koltuk(lar) şu an başka müşteride: '.implode(', ', $conflictHolds),
                    'conflicts' => array_values($conflictHolds),
                ], 422));
            }

            // 2) Satın alınmış koltuklarla çakışma
            $taken = [];
            if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'seats')) {
                $raw = DB::table('orders')
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->pluck('seats')->all();

                $taken = collect($raw)->flatMap(function ($v) {
                    if (is_array($v)) return $v;
                    if (is_string($v) && $v !== '') {
                        $j = json_decode($v, true);
                        return is_array($j) ? $j : [];
                    }
                    return [];
                })->unique()->values()->all();
            }

            $conflicts = array_values(array_intersect($seats, $taken));
            if (!empty($conflicts)) {
                abort(response()->json([
                    'status'  => false,
                    'message' => 'Seats already taken: '.implode(', ', $conflicts),
                    'conflicts' => $conflicts,
                ], 422));
            }

            // 3) Siparişi oluştur
            $unit  = (float) $product->cost;
            $total = $unit * (int) $data['qty'];

            $order = Order::create([
                'user_id'               => optional($request->user())->id,
                'product_id'            => $product->id,
                'qty'                   => $data['qty'],
                'unit_price'            => $unit,
                'total'                 => $total,
                'passenger_name'        => $data['passenger_name'],
                'passenger_doc'         => $data['passenger_doc_type'] ?? null,
                'passenger_national_id' => ($data['passenger_doc_type'] ?? '') === 'tc' ? ($data['passenger_national_id'] ?? null) : null,
                'passenger_passport_no' => ($data['passenger_doc_type'] ?? '') === 'passport' ? ($data['passenger_passport_no'] ?? null) : null,
                'passenger_nationality' => $data['passenger_nationality'] ?? 'TR',
                'passenger_email'       => $data['passenger_email'] ?? null,
                'passenger_phone'       => $data['passenger_phone'] ?? null,
                'seats'                 => $seats,
                'pnr'                   => strtoupper(Str::random(6)),
                'status'                => 'paid',
            ]);

            // 4) Bu rezervasyona ait hold’ları temizle
            if (!empty($data['reservation_id'])) {
                DB::table('seat_holds')->where('reservation_id', $data['reservation_id'])->delete();
            }

            return $order->load([
                'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
            ]);
        });

        return response()->json([
            'status'  => true,
            'message' => 'Order created',
            'order'   => $order,
            'pnr'     => $order->pnr,
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
