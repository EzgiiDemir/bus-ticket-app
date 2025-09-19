<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // users: company_id, role_status
        Schema::table('users', function (Blueprint $t) {
            if (!Schema::hasColumn('users', 'company_id')) {
                $t->unsignedBigInteger('company_id')->nullable()->after('role');
                $t->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
            }
            if (!Schema::hasColumn('users', 'role_status')) {
                $t->enum('role_status', ['pending', 'active', 'rejected'])->default('active')->after('role');
            }
        });

        // products: company_id, company_name, created_by, updated_by, departure_time index
        Schema::table('products', function (Blueprint $t) {
            if (!Schema::hasColumn('products', 'company_id')) {
                $t->unsignedBigInteger('company_id')->nullable()->after('user_id');
                $t->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            }
            if (!Schema::hasColumn('products', 'company_name')) {
                $t->string('company_name')->nullable()->after('company_id');
            }
            if (!Schema::hasColumn('products', 'created_by')) {
                $t->string('created_by')->nullable()->after('is_active');
            }
            if (!Schema::hasColumn('products', 'updated_by')) {
                $t->string('updated_by')->nullable()->after('created_by');
            }
        });

        // indexes (idempotent)
        $this->addIndexIfMissing('products', 'departure_time', 'products_departure_time_index');
        $this->addIndexIfMissing('products', ['company_id', 'user_id'], 'products_company_user_idx');

        $this->addIndexIfMissing('orders', ['status', 'created_at'], 'orders_status_created_idx');
        $this->addIndexIfMissing('orders', 'product_id', 'orders_product_id_idx');

        // view-friendly computed column yok, API formatlayacak
    }

    public function down(): void
    {
        // indeksleri geri almak opsiyonel. foreign/columns için temkinli davran.
        // Prod’da genelde down boş bırakılır.
    }

    private function addIndexIfMissing(string $table, string|array $columns, string $indexName): void
    {
        $exists = DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();

        if (!$exists) {
            Schema::table($table, function (Blueprint $t) use ($columns, $indexName) {
                $t->index((array)$columns, $indexName);
            });
        }
    }
};
