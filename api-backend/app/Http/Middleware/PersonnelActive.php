<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PersonnelActive
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $u = $request->user();
        if (!$u || ($u->role ?? null) !== 'personnel' || ($u->role_status ?? null) !== 'active') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return $next($request);
    }
}
