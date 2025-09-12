<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();     // yolcu
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete(); // sefer
            $table->unsignedInteger('qty');
            $table->decimal('unit_price',10,2);
            $table->decimal('total',10,2);
            $table->string('passenger_name');
            $table->string('passenger_email');
            $table->string('passenger_phone')->nullable();
            $table->string('pnr')->unique();
            $table->string('status')->default('paid'); // paid/cancelled/refunded
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('orders'); }
};
