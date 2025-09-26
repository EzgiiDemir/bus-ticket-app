<?php

use App\Http\Controllers\Admin\PeopleController;
use App\Http\Controllers\AdminApprovalController;
use App\Http\Controllers\Company\DashboardController;
use App\Http\Controllers\Company\ExportController;
use App\Http\Controllers\CompanyApprovalController;
use App\Http\Controllers\Personnel\SeatOverrideController;
use App\Http\Controllers\SeatHoldController;
use App\Http\Controllers\Admin\TripAnalyticsController;
use App\Http\Controllers\PublicProductController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Models\Company;
use App\Models\Terminal;

Route::prefix('public')
    ->withoutMiddleware(['auth:sanctum'])
    ->group(function () {
        Route::get('/products', [PublicProductController::class, 'index']);
        Route::get('/products/{product}', [PublicProductController::class, 'show']);
    });

// --- Public ---
Route::get('/public/products', [ProductController::class, 'publicIndex']);

Route::get('/public/companies', fn () =>
response()->json(
    Company::select('id','name','code')->orderBy('name')->get()
)
);

Route::get('/public/terminals', fn () =>
response()->json(
    Terminal::select('id','name','city','code')
        ->orderBy('city')->orderBy('name')->get()
)
);

Route::post('/seat-holds', [SeatHoldController::class,'store']);
Route::delete('/seat-holds/{reservation}', [SeatHoldController::class,'destroy']);
Route::post('/seat-holds/{reservation}/extend', [SeatHoldController::class,'extend']);

// --- Auth (genel) ---
Route::post('/register',[AuthController::class,'register']);
Route::post('/login',[AuthController::class,'login']);
Route::post('/password/forgot',[AuthController::class,'forgotPassword']);
Route::post('/password/reset',[AuthController::class,'resetPassword']);

// --- Admin approvals (sadece approvals) ---
Route::prefix('admin')->middleware(['auth:sanctum','admin.only'])->group(function () {
    Route::get('/trips/{product}/creator', [TripAnalyticsController::class, 'creator']);
    Route::get('/trips/{product}/buyers',  [TripAnalyticsController::class, 'buyers']);
    Route::get('/customers', [PeopleController::class, 'customers']);
    Route::get('/customers/{identifier}/orders', [PeopleController::class, 'customerOrders']);

    Route::get('/approvals', [AdminApprovalController::class,'index']);
    Route::post('/approvals/{id}/approve', [AdminApprovalController::class,'approve']);
    Route::post('/approvals/{id}/reject',  [AdminApprovalController::class,'reject']);
});

Route::middleware('auth:sanctum')->group(function () {

    // --- COMPANY (İK) ---
    Route::prefix('company')->middleware('company.approver')->group(function () {
        Route::get('/approvals', [CompanyApprovalController::class,'index']);
        Route::post('/approvals/{id}/approve', [CompanyApprovalController::class,'approve']);
        Route::post('/approvals/{id}/reject',  [CompanyApprovalController::class,'reject']);
        Route::get('/trips', [\App\Http\Controllers\Company\TripController::class,'index']);
        Route::get('/customers', [\App\Http\Controllers\Company\CustomerController::class,'index']);
        Route::get('/personnel', [\App\Http\Controllers\Company\PersonnelController::class,'index']);
        Route::get('/stats', [DashboardController::class,'stats']);
        Route::get('/me',    [\App\Http\Controllers\Company\DashboardController::class,'me']);
        Route::post('/export/array', [\App\Http\Controllers\Company\ExportController::class,'array']);
        Route::get('/export/trips',  [ExportController::class, 'trips']);
        Route::post('/export/array', [ExportController::class, 'array']);
    });

    // profil
    Route::get('/profile',[AuthController::class,'profile']);
    Route::put('/me',[AuthController::class,'updateProfile']);
    Route::put('/me/password',[AuthController::class,'changePassword']);
    Route::get('/logout',[AuthController::class,'logout']);

    // yolcu siparişleri
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);

    // ürünler
    Route::get('/products', [ProductController::class,'index']);
    Route::get('/products/{product}', [ProductController::class,'show']);

    // --- ADMIN (diğer admin endpointleri) ---
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
    });

    // --- PERSONNEL ---
    Route::middleware('personnel.active')->group(function () {
        Route::post('/products', [ProductController::class,'store']);
        Route::put('/products/{id}', [ProductController::class,'update']);
        Route::delete('/products/{id}', [ProductController::class,'destroy']);
        Route::get('/products/{product}/orders', [\App\Http\Controllers\Personnel\PeopleController::class, 'ordersByProduct']);

        Route::prefix('personnel')->group(function () {
            Route::get('/products/{product}/seat-overrides', [SeatOverrideController::class,'index']);
            Route::post('/products/{product}/seat-overrides', [SeatOverrideController::class,'store']);
            Route::delete('/products/{product}/seat-overrides/{override}', [SeatOverrideController::class,'destroy']);
            Route::get('/stats', [\App\Http\Controllers\Personnel\StatsController::class,'index']);
            Route::get('/orders', [\App\Http\Controllers\Personnel\PeopleController::class,'orders']);
            Route::get('/customers', [\App\Http\Controllers\Personnel\PeopleController::class,'customers']);
            Route::get('/company', fn () => response()->json(
                Company::select('id','name','code')->find(request()->user()->company_id)
            ));
        });
    });
});
