<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Kolonları ekle
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'created_by')) {
                $table->foreignId('created_by')->nullable()
                    ->after('user_id')
                    ->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('products', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()
                    ->after('created_by')
                    ->constrained('users')->nullOnDelete();
            }
            if (Schema::hasColumn('products', 'company_id')) {
                $table->index('company_id');
            }
        });

        // Backfill: created_by boşsa user_id ile doldur
        if (Schema::hasColumn('products','created_by') && Schema::hasColumn('products','user_id')) {
            DB::table('products')
                ->whereNull('created_by')
                ->whereNotNull('user_id')
                ->update(['created_by' => DB::raw('user_id')]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'updated_by')) {
                $table->dropConstrainedForeignId('updated_by');
            }
            if (Schema::hasColumn('products', 'created_by')) {
                $table->dropConstrainedForeignId('created_by');
            }
        });
    }
};
