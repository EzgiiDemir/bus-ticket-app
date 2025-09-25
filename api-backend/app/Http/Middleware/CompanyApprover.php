<?php
namespace App\Http\Middleware;

use Closure;

class CompanyApprover {
    public function handle($request, Closure $next){
        $u = $request->user();
        if (!$u || $u->role!=='company_approver') return response()->json(['message'=>'Forbidden'],403);
        return $next($request);
    }
}
