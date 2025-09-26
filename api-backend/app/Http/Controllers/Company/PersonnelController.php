<?php

namespace App\Http\Controllers\Company;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;

class PersonnelController extends Controller
{
    public function index(Request $r)
    {
        $u = $r->user();
        if (!$u || !$u->company_id) {
            return response()->json(['status'=>false,'message'=>'Firma bulunamadı'], 404);
        }

        $q = User::query()
            ->select(['id','name','email','role_status as status'])
            ->where('company_id', $u->company_id)
            ->where('role', 'personnel')
            ->orderBy('name');

        $perPage = (int) $r->integer('per_page', 100);
        return response()->json($q->paginate($perPage));
    }
}
