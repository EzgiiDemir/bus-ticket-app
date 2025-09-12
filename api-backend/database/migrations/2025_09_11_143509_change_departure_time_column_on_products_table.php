<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('products', function (Blueprint $table) {
            $table->dateTime('departure_time')->change();
        });
    }

    public function down(): void {
        Schema::table('products', function (Blueprint $table) {
            $table->time('departure_time')->change();
        });
    }
};
