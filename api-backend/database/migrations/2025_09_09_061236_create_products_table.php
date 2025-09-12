<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('trip');
            $table->string('company_name');
            $table->string('terminal_from');
            $table->string('terminal_to');
            $table->dateTime('departure_time');               // kritik: datetime
            $table->decimal('cost',10,2);
            $table->integer('capacity_reservation')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('created_by')->nullable();
            $table->string('updated_by')->nullable();
            $table->string('note',500)->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('products'); }
};
