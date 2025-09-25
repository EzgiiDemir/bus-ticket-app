<?php

namespace App\Http\Controllers\Personnel;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\SeatOverride;
use Illuminate\Http\Request;

class SeatOverrideController extends Controller
{
    public function index(Product $product)
    {
        $this->authorizePersonnel();
        return response()->json(
            SeatOverride::where('product_id',$product->id)
                ->orderBy('seat_code')
                ->get()
        );
    }

    public function store(Request $r, Product $product)
    {
        $this->authorizePersonnel();

        $data = $r->validate([
            'seat_code' => ['required','string','max:8'],
            'type'      => ['nullable','in:fault,blocked'],
            'label'     => ['nullable','string','max:24'],
            'reason'    => ['nullable','string','max:255'],
            'starts_at' => ['nullable','date'],
            'ends_at'   => ['nullable','date','after_or_equal:starts_at'],
        ]);

        $data['seat_code'] = strtoupper($data['seat_code']);
        $data['type']      = $data['type'] ?? 'fault';
        $data['label']     = $data['label'] ?? ($data['type']==='fault' ? 'Arıza' : 'Kapalı');
        $data['product_id']= $product->id;
        $data['created_by']= optional($r->user())->id;

        $ov = SeatOverride::updateOrCreate(
            ['product_id'=>$product->id,'seat_code'=>$data['seat_code'],'type'=>$data['type']],
            $data
        );

        return response()->json(['status'=>true,'override'=>$ov], 201);
    }

    public function destroy(Product $product, SeatOverride $override)
    {
        $this->authorizePersonnel();
        if ($override->product_id !== $product->id) {
            return response()->json(['message'=>'Mismatch'], 422);
        }
        $override->delete();
        return response()->json(['status'=>true]);
    }

    private function authorizePersonnel(): void
    {
        $u = auth('sanctum')->user();
        abort_unless($u && in_array($u->role, ['personnel','admin']), 403);
    }
}
