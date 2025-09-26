<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'personnel.active' => \App\Http\Middleware\PersonnelActive::class,

            'admin.only'       => \App\Http\Middleware\AdminOnly::class,
            'admin'            => \App\Http\Middleware\AdminOnly::class,

            'company.approver' => \App\Http\Middleware\CompanyApprover::class,

        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
