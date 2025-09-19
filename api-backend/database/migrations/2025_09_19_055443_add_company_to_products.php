<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // company_id kolonu
        Schema::table('products', function (Blueprint $t) {
            if (!Schema::hasColumn('products','company_id')) {
                $t->foreignId('company_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
            }
        });

        // index var mı kontrol helper
        $hasIndex = function (string $index) {
            return DB::table('information_schema.statistics')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_name', 'products')
                ->where('index_name', $index)
                ->exists();
        };

        // güvenli index ekleme
        if (!$hasIndex('products_user_id_company_id_index')) {
            DB::statement('CREATE INDEX products_user_id_company_id_index ON products(user_id, company_id)');
        }
        if (!$hasIndex('products_departure_time_index')) {
            DB::statement('CREATE INDEX products_departure_time_index ON products(departure_time)');
        }
        if (!$hasIndex('products_is_active_index')) {
            DB::statement('CREATE INDEX products_is_active_index ON products(is_active)');
        }
    }

    public function down(): void
    {
        // indexleri güvenli sil
        foreach ([
                     'products_user_id_company_id_index',
                     'products_departure_time_index',
                     'products_is_active_index',
                 ] as $idx) {
            try { DB::statement("DROP INDEX $idx ON products"); } catch (\Throwable $e) {}
        }

        // company_id güvenli kaldır
        Schema::table('products', function (Blueprint $t) {
            if (Schema::hasColumn('products','company_id')) {
                try { $t->dropConstrainedForeignId('company_id'); } catch (\Throwable $e) {}
                try { $t->dropColumn('company_id'); } catch (\Throwable $e) {}
            }
        });
    }
};
