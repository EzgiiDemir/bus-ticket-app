<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PublicProductController extends Controller
{
    private function j2a($v): array {
        if (is_array($v)) return $v;
        if (is_string($v) && $v !== '') {
            $d = json_decode($v, true);
            return is_array($d) ? $d : [];
        }
        return [];
    }

    public function index(Request $req)
    {
        $q = $req->query('q');
        $products = Product::query()
            ->where('is_active', 1)
            ->when($q, function($qr) use ($q){
                $qr->where(function($w) use ($q){
                    $w->where('trip','like',"%$q%")
                        ->orWhere('company_name','like',"%$q%")
                        ->orWhere('terminal_from','like',"%$q%")
                        ->orWhere('terminal_to','like',"%$q%");
                });
            })
            ->orderBy('departure_time')
            ->get([
                'id','trip','company_name','terminal_from','terminal_to',
                'departure_time','cost','duration','bus_type','note','is_active'
            ]);

        return response()->json(['products'=>$products]);
    }

    public function show(Product $product)
    {
        if (!$product->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $layout = in_array($product->bus_type, ['2+1','2+2']) ? $product->bus_type : '2+1';
        $rows   = $product->seat_rows ?? 12;
        $route  = $this->j2a($product->route ?? []);

        // Satın alınmış koltuklar
        $purchased = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('order_items') &&
                \Illuminate\Support\Facades\Schema::hasColumn('order_items','seats')) {
                $raw = \Illuminate\Support\Facades\DB::table('order_items')
                    ->where('product_id', $product->id)
                    ->pluck('seats')->all();
                $purchased = collect($raw)
                    ->flatMap(fn($v) => $this->j2a($v))
                    ->filter(fn($s) => is_string($s) && $s !== '')
                    ->values()->all();
            } elseif (\Illuminate\Support\Facades\Schema::hasTable('orders') &&
                \Illuminate\Support\Facades\Schema::hasColumn('orders','seats')) {
                $raw = \Illuminate\Support\Facades\DB::table('orders')
                    ->where('product_id', $product->id)
                    ->pluck('seats')->all();
                $purchased = collect($raw)
                    ->flatMap(fn($v) => $this->j2a($v))
                    ->filter(fn($s) => is_string($s) && $s !== '')
                    ->values()->all();
            }
        } catch (\Throwable $e) {
            $purchased = [];
        }

        // Aktif hold'lar
        $holds = [];
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('seat_holds')) {
                $holds = \Illuminate\Support\Facades\DB::table('seat_holds')
                    ->where('product_id', $product->id)
                    ->where('expires_at', '>', now())
                    ->pluck('seat')->all();
            }
        } catch (\Throwable $e) {
            $holds = [];
        }

        // Birleştirilmiş dolu koltuk listesi
        $taken = array_values(
            collect($purchased)->merge($holds)
                ->filter(fn($s) => is_string($s) && $s !== '')
                ->unique()->all()
        );

        return response()->json([
            'id'                  => $product->id,
            'trip'                => $product->trip,
            'company_name'        => $product->company_name,
            'terminal_from'       => $product->terminal_from,
            'terminal_to'         => $product->terminal_to,
            'departure_time'      => $product->departure_time,
            'cost'                => $product->cost,
            'duration'            => $product->duration,
            'bus_type'            => $product->bus_type,
            'note'                => $product->note,
            'route'               => $route,
            'important_notes'     => $product->important_notes,
            'cancellation_policy' => $product->cancellation_policy,
            'seat_map'            => ['layout' => $layout, 'rows' => $rows],
            'taken_seats'         => $taken,
            'is_active'           => (bool) $product->is_active,
        ]);
    }
}
