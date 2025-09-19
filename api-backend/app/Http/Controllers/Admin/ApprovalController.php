<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\RoleRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ApprovalController extends Controller
{
    // FRONTEND listApprovals() -> r.data.users bekliyor
    public function index()
    {
        // En garanti yöntem: pending personel kullanıcılarını getir
        $users = User::with('company:id,name,code')
            ->where('role', 'personnel')
            ->where('role_status', 'pending')
            ->orderByDesc('created_at')
            ->get(['id','name','email','company_id','role_status','created_at']);

        return response()->json(['users' => $users]);
    }

    public function approve(Request $r, User $user)
    {
        abort_unless($user->role === 'personnel', 404);

        $user->update(['role_status' => 'active']);

        // varsa RoleRequest kaydını da kapat
        RoleRequest::where('user_id', $user->id)
            ->where('type', 'personnel_request')
            ->where('status', 'pending')
            ->latest()
            ->first()?->update([
                'status'      => 'approved',
                'reviewed_by' => $r->user()->id,
                'reviewed_at' => Carbon::now(),
            ]);

        return response()->json(['status' => true, 'message' => 'Approved']);
    }

    public function reject(Request $r, User $user)
    {
        abort_unless($user->role === 'personnel', 404);

        $user->update(['role_status' => 'rejected']);

        RoleRequest::where('user_id', $user->id)
            ->where('type', 'personnel_request')
            ->where('status', 'pending')
            ->latest()
            ->first()?->update([
                'status'      => 'rejected',
                'reviewed_by' => $r->user()->id,
                'reviewed_at' => now(),
                'note'        => $r->input('note'),
            ]);

        return response()->json(['status' => true, 'message' => 'Rejected']);
    }
}
