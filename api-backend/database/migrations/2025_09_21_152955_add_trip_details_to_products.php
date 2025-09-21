<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('products', function (Blueprint $t) {
            if (!Schema::hasColumn('products','duration')) $t->string('duration')->nullable()->after('departure_time');
            if (!Schema::hasColumn('products','route')) $t->json('route')->nullable()->after('duration');
            if (!Schema::hasColumn('products','bus_type')) $t->string('bus_type')->nullable()->after('route');
            if (!Schema::hasColumn('products','important_notes')) $t->text('important_notes')->nullable()->after('bus_type');
            if (!Schema::hasColumn('products','cancellation_policy')) $t->text('cancellation_policy')->nullable()->after('important_notes');
        });
    }

    public function down(): void {
        Schema::table('products', function (Blueprint $t) {
            $t->dropColumn(['duration','route','bus_type','important_notes','cancellation_policy']);
        });
    }
};
