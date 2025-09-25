<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('seat_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('seat_code', 8); // örn: 1A, 10C
            $table->enum('type', ['fault','blocked'])->default('fault'); // fault=arızalı, blocked=manuel kapalı
            $table->string('label', 24)->default('Arıza'); // UI etiketi
            $table->string('reason', 255)->nullable();     // açıklama
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->unique(['product_id','seat_code','type'], 'u_product_seat_type');
            $table->index(['product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seat_overrides');
    }
};
