<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('terminals', function (Blueprint $t) {
            $t->id();
            $t->string('city');
            $t->string('name');
            $t->string('code')->unique();
            $t->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('terminals');
    }
};
