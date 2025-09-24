<?php
declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensure the authenticated user is an active personnel.
 */
class PersonnelActive
{
    /**
     * Handle an incoming request.
     *
     * @param  Request  $request
     * @param  Closure  $next
     * @return Response|\Illuminate\Http\JsonResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (
            !$user
            || ($user->role ?? null) !== 'personnel'
            || ($user->role_status ?? null) !== 'active'
        ) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
