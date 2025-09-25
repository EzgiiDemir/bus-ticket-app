<?php

namespace App\Http\Controllers;

use App\Models\RoleRequest;
use App\Models\User;
use Illuminate\Http\Request;

class AdminApprovalController extends Controller
{
    public function index(Request $r){
        $u = $r->user();
        abort_unless($u && $u->role==='admin', 403);

        $q = RoleRequest::with(['user:id,name,email','Company:id,name'])
            ->where('role','personnel')
            ->where('company_status','approved')
            ->where('admin_status','pending')
            ->latest();

        return response()->json($q->paginate((int)$r->integer('per_page',50)));
    }

    public function approve(Request $r, $id){
        $u = $r->user();
        abort_unless($u && $u->role==='admin', 403);

        $rr = RoleRequest::findOrFail($id);
        if ($rr->company_status !== 'approved') {
            return response()->json(['status'=>false,'message'=>'Önce firma onayı gerekir.'], 422);
        }

        $rr->update([
            'admin_status'     => 'approved',
            'admin_note'       => $r->string('note')->value(),
            'admin_decided_by' => $u->id,
            'status'           => 'approved',
        ]);

        User::where('id',$rr->user_id)->update(['role_status'=>'active']);

        return response()->json(['status'=>true,'message'=>'Admin onayı verildi.','request'=>$rr->fresh()]);
    }

    public function reject(Request $r, $id){
        $u = $r->user();
        abort_unless($u && $u->role==='admin', 403);

        $rr = RoleRequest::findOrFail($id);
        $rr->update([
            'admin_status'     => 'rejected',
            'admin_note'       => $r->string('note')->value(),
            'admin_decided_by' => $u->id,
            'status'           => 'rejected',
        ]);

        User::where('id',$rr->user_id)->update(['role_status'=>'rejected']);

        return response()->json(['status'=>true,'message'=>'Admin reddetti.','request'=>$rr->fresh()]);
    }
}
