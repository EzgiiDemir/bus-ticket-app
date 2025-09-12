<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;

Route::get('/public/products', [ProductController::class, 'publicIndex']);

// ---- AUTH GEREKTİREN ENDPOINTS ----
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/profile',[AuthController::class,'profile']);
    Route::put('/me',[AuthController::class,'updateProfile']);
    Route::put('/me/password',[AuthController::class,'changePassword']);
    Route::get('/logout',[AuthController::class,'logout']);

    // personel CRUD
    Route::apiResource('/products', ProductController::class);

    // yolcu siparişleri
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
});

// auth
Route::post('/register',[AuthController::class,'register']);
Route::post('/login',[AuthController::class,'login']);

// şifre
Route::post('/password/forgot',[AuthController::class,'forgotPassword']);
Route::post('/password/reset',[AuthController::class,'resetPassword']);
