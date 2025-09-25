<?php

namespace App\Http\Controllers\Personnel;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        // İlişki yoksa basit bir payload dön.
        $company = method_exists($user, 'Company') && $user->relationLoaded('Company')
            ? $user->company
            : (method_exists($user, 'Company') ? $user->company()->first() : null);

        return response()->json([
            'Company' => $company
                ? [
                    'id' => $company->id,
                    'name' => $company->name ?? 'N/A',
                ]
                : [
                    'id' => 0,
                    'name' => 'Demo Company',
                ],
            'user' => [
                'id' => $user->id,
                'name' => $user->name ?? 'N/A',
                'email' => $user->email ?? 'N/A',
            ],
        ]);
    }
}
