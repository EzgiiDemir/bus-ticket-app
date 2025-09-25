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

        $q = Order::query()
            ->with(['product:id,trip,terminal_from,terminal_to,departure_time,cost'])
            ->where('user_id', $u->id)
            ->latest();

        $perPage = (int) $r->integer('per_page', 10);
        return response()->json($q->paginate($perPage));
    }

    public function store(Request $request)
    {
        // Frontend payload uyumu
        // {
        //   product_id, qty, seats:[...],
        //   passengers:[{seat,first_name,last_name,doc_type,national_id?,passport_no?,nationality?,email?,phone?},...],
        //   card_holder, card_number, card_exp, card_cvv, reservation_id?
        // }

        $v = $request->validate([
            'product_id'   => ['required','exists:products,id'],
            'qty'          => ['required','integer','min:1','max:10'],
            'seats'        => ['required','array','min:1','max:10'],
            'seats.*'      => ['string'],

            'passengers'                      => ['required','array','min:1','max:10'],
            'passengers.*.seat'               => ['required','string','max:8'],
            'passengers.*.first_name'         => ['required','string','max:120'],
            'passengers.*.last_name'          => ['required','string','max:120'],
            'passengers.*.doc_type'           => ['required','in:tc,passport'],
            'passengers.*.national_id'        => ['nullable','string','max:32','required_if:passengers.*.doc_type,tc'],
            'passengers.*.passport_no'        => ['nullable','string','max:64','required_if:passengers.*.doc_type,passport'],
            'passengers.*.nationality'        => ['nullable','string','max:5'],
            'passengers.*.email'              => ['nullable','email'],
            'passengers.*.phone'              => ['nullable','string','max:32'],

            'reservation_id' => ['nullable','uuid'],
            'card_holder'    => ['required','string','max:150'],
            'card_number'    => ['required','string','min:10','max:25'],
            'card_exp'       => ['required','string','max:7'],
            'card_cvv'       => ['required','string','min:3','max:4'],
        ]);

        // Sayı eşleşmeleri
        $seats = collect($v['seats'])->filter()->unique()->values()->all();
        $passengers = collect($v['passengers'])->map(fn($p)=>[
            'seat'        => (string) $p['seat'],
            'first_name'  => trim($p['first_name']),
            'last_name'   => trim($p['last_name']),
            'doc_type'    => $p['doc_type'],
            'national_id' => $p['doc_type']==='tc' ? ($p['national_id'] ?? null) : null,
            'passport_no' => $p['doc_type']==='passport' ? ($p['passport_no'] ?? null) : null,
            'nationality' => $p['doc_type']==='passport' ? ($p['nationality'] ?? 'TR') : 'TR',
            'email'       => $p['email'] ?? null,
            'phone'       => $p['phone'] ?? null,
        ])->values()->all();

        if ((int)$v['qty'] !== count($seats)) {
            return response()->json(['status'=>false,'message'=>'Adet ile koltuk sayısı eşleşmiyor.'], 422);
        }
        if (count($passengers) !== count($seats)) {
            return response()->json(['status'=>false,'message'=>'Yolcu sayısı ile koltuk sayısı eşleşmiyor.'], 422);
        }

        // Yolcu koltuklarının seats ile uyumu
        $pSeats = collect($passengers)->pluck('seat')->all();
        sort($pSeats); $sSeats = $seats; sort($sSeats);
        if ($pSeats !== $sSeats) {
            return response()->json(['status'=>false,'message'=>'Yolcu koltukları ile seçilen koltuklar uyuşmuyor.'], 422);
        }

        $product = Product::findOrFail($v['product_id']);
        if (!$product->is_active) {
            return response()->json(['status'=>false,'message'=>'Trip not available'], 422);
        }

        $order = DB::transaction(function () use ($request, $product, $v, $seats, $passengers) {
            // 1) Aktif hold çatışması
            $conflictHolds = DB::table('seat_holds')
                ->where('product_id', $product->id)
                ->whereIn('seat', $seats)
                ->where('expires_at', '>', now())
                ->when($v['reservation_id'] ?? null, function ($q) use ($v) {
                    $q->where('reservation_id', '<>', $v['reservation_id']);
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
                    'status'    => false,
                    'message'   => 'Seats already taken: '.implode(', ', $conflicts),
                    'conflicts' => $conflicts,
                ], 422));
            }

            // 3) Siparişi oluştur
            $unit  = (float) $product->cost;
            $qty   = (int) $v['qty'];
            $total = $unit * $qty;

            $first = $passengers[0];
            $payload = [
                'user_id'               => optional($request->user())->id,
                'product_id'            => $product->id,
                'qty'                   => $qty,
                'unit_price'            => $unit,
                'total'                 => $total,

                // Geriye dönük uyumluluk için ilk yolcuyu düz alanlara yaz
                'passenger_name'        => trim($first['first_name'].' '.$first['last_name']),
                'passenger_doc'         => $first['doc_type'],
                'passenger_national_id' => $first['doc_type']==='tc' ? ($first['national_id'] ?? null) : null,
                'passenger_passport_no' => $first['doc_type']==='passport' ? ($first['passport_no'] ?? null) : null,
                'passenger_nationality' => $first['nationality'] ?? 'TR',
                'passenger_email'       => $first['email'] ?? null,
                'passenger_phone'       => $first['phone'] ?? null,

                'seats'                 => $seats,
                'pnr'                   => strtoupper(Str::random(6)),
                'status'                => 'paid',
            ];

            // Varsa tüm yolcuları JSON sütununa da koy
            if (Schema::hasColumn('orders','passengers')) {
                $payload['passengers'] = $passengers;
            }

            $order = Order::create($payload);

            // 4) Bu rezervasyona ait hold’ları temizle
            if (!empty($v['reservation_id'])) {
                DB::table('seat_holds')->where('reservation_id', $v['reservation_id'])->delete();
            }

            return $order->load([
                'product:id,trip,company_name,terminal_from,terminal_to,departure_time,cost'
            ]);
        });

        return response()->json([
            'status'  => true,
            'message' => 'Satın alma başarılı.',
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
