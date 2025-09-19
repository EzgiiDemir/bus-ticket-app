<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        try {
            DB::statement("
                ALTER TABLE users
                MODIFY role ENUM('passenger','personnel','admin') NOT NULL DEFAULT 'passenger'
            ");
        } catch (\Throwable $e) {
        }

        Schema::table('users', function (Blueprint $table) {
            // role_status yoksa ekle
            if (!Schema::hasColumn('users', 'role_status')) {
                $table->enum('role_status', ['pending','active','rejected'])
                    ->default('active')->after('role');
            }

            if (!Schema::hasColumn('users', 'company_id')) {
                $table->foreignId('company_id')
                    ->nullable()->after('role_status')
                    ->constrained()->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'company_id')) {
                try { $table->dropConstrainedForeignId('company_id'); } catch (\Throwable $e) {}
                try { $table->dropColumn('company_id'); } catch (\Throwable $e) {}
            }
            if (Schema::hasColumn('users', 'role_status')) {
                try { $table->dropColumn('role_status'); } catch (\Throwable $e) {}
            }
        });
    }
};
