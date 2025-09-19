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
        // ALIASES
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminOnly::class,
            'personnel.active' => \App\Http\Middleware\PersonnelActive::class,
        ]);

        // (opsiyonel) grup eklemiyorsan başka ayar gerekmez
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
