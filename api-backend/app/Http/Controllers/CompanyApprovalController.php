<?php

namespace App\Http\Controllers;

use App\Models\RoleRequest;
use App\Models\User;
use Illuminate\Http\Request;

class CompanyApprovalController extends Controller
{
    public function index(Request $r){
        $u = $r->user(); // company_approver
        abort_unless($u && $u->role==='company_approver', 403);

        $q = RoleRequest::with(['user:id,name,email,company_id','Company:id,name'])
            ->where('company_id',$u->company_id)
            ->where('role','personnel')
            ->latest();

        return response()->json($q->paginate((int)$r->integer('per_page',50)));
    }

    public function approve(Request $r, $id){
        $u = $r->user();
        abort_unless($u && $u->role==='company_approver', 403);

        $rr = RoleRequest::where('id',$id)->where('company_id',$u->company_id)->firstOrFail();

        $rr->update([
            'company_status'     => 'approved',
            'company_note'       => $r->string('note')->value(), // Stringable -> value()
            'company_decided_by' => $u->id,
            // legacy senk. (tablo varsa)
            'status'             => 'approved',
        ]);

        User::where('id',$rr->user_id)->update(['role_status'=>'company_approved']);

        return response()->json(['status'=>true,'message'=>'Firma onayı verildi.','request'=>$rr->fresh()]);
    }

    public function reject(Request $r, $id){
        $u = $r->user();
        abort_unless($u && $u->role==='company_approver', 403);

        $rr = RoleRequest::where('id',$id)->where('company_id',$u->company_id)->firstOrFail();

        $rr->update([
            'company_status'     => 'rejected',
            'admin_status'       => 'rejected', // admin kuyruğuna düşmesin
            'company_note'       => $r->string('note')->value(),
            'company_decided_by' => $u->id,
            'status'             => 'rejected',
        ]);

        User::where('id',$rr->user_id)->update(['role_status'=>'rejected']);

        return response()->json(['status'=>true,'message'=>'Firma reddetti.','request'=>$rr->fresh()]);
    }
}
