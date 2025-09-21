<?php

use App\Http\Controllers\PublicProductController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\Admin\ApprovalController;
use App\Models\Company;
use App\Models\Terminal;


Route::prefix('public')
    ->withoutMiddleware(['auth:sanctum'])   // kritik
    ->group(function () {
        Route::get('/products', [PublicProductController::class, 'index']);
        Route::get('/products/{product}', [PublicProductController::class, 'show']);
    });

// --- Public ---
Route::get('/public/products', [ProductController::class, 'publicIndex']);
Route::get('/public/companies', fn() =>
response()->json(Company::select('id','name','code')->orderBy('name')->get())
);

// --- Auth (genel) ---
Route::post('/register',[AuthController::class,'register']);
Route::post('/login',[AuthController::class,'login']);
Route::post('/password/forgot',[AuthController::class,'forgotPassword']);
Route::post('/password/reset',[AuthController::class,'resetPassword']);

Route::middleware('auth:sanctum')->group(function () {
    // profil
    Route::get('/profile',[AuthController::class,'profile']);
    Route::put('/me',[AuthController::class,'updateProfile']);
    Route::put('/me/password',[AuthController::class,'changePassword']);
    Route::get('/logout',[AuthController::class,'logout']);

    // yolcu siparişleri
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);

    // ürün görüntüleme
    Route::get('/products', [ProductController::class,'index']);
    Route::get('/products/{product}', [ProductController::class,'show']);

    // --- ADMIN ---
    Route::middleware('admin')->prefix('admin')->group(function () {
        // dashboard
        Route::get('/dashboard/overview', [\App\Http\Controllers\Admin\DashboardController::class,'overview']);
        Route::get('/dashboard/revenue-timeseries', [\App\Http\Controllers\Admin\DashboardController::class,'revenueTimeseries']);
        Route::get('/dashboard/company-breakdown', [\App\Http\Controllers\Admin\DashboardController::class,'companyBreakdown']);
        Route::get('/dashboard/top-routes', [\App\Http\Controllers\Admin\DashboardController::class,'topRoutes']);

        // listeler
        Route::get('/personnel', [\App\Http\Controllers\Admin\PeopleController::class,'personnel']);
        Route::get('/customers', [\App\Http\Controllers\Admin\PeopleController::class,'customers']);
        Route::get('/companies', [\App\Http\Controllers\Admin\CompanyController::class,'index']);
        Route::get('/trips', [\App\Http\Controllers\Admin\TripController::class,'index']);

        // onay akışı
        Route::get('/approvals', [ApprovalController::class,'index']);
        Route::post('/approvals/{user}/approve', [ApprovalController::class,'approve']);
        Route::post('/approvals/{user}/reject', [ApprovalController::class,'reject']);
    });

    // --- PERSONNEL ---
    Route::middleware('personnel.active')->group(function () {
        Route::post('/products', [ProductController::class,'store']);
        Route::put('/products/{id}', [ProductController::class,'update']);
        Route::delete('/products/{id}', [ProductController::class,'destroy']);

        Route::prefix('personnel')->group(function () {
            Route::get('/stats', [\App\Http\Controllers\Personnel\StatsController::class,'index']);
            Route::get('/orders', [\App\Http\Controllers\Personnel\PeopleController::class,'orders']);
            Route::get('/customers', [\App\Http\Controllers\Personnel\PeopleController::class,'customers']);
            Route::get('/company', fn () => response()->json(
                Company::select('id','name','code')->find(request()->user()->company_id)
            ));
        });
    });

    Route::get('/public/terminals', fn() =>
    response()->json([
        'terminals' => Terminal::select('id','name','city','code')
            ->orderBy('city')->orderBy('name')->get()
    ])
    );

});
