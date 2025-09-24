<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('seat_holds', function (Blueprint $t) {
            $t->id();
            $t->uuid('reservation_id')->index();
            $t->unsignedBigInteger('product_id');
            $t->string('seat', 8);
            $t->unsignedBigInteger('user_id')->nullable();
            $t->timestamp('expires_at')->index();
            $t->timestamps();

            $t->unique(['product_id','seat']); // aynı anda tek kişi tutabilsin
            $t->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }
    public function down(): void {
        Schema::dropIfExists('seat_holds');
    }
};
