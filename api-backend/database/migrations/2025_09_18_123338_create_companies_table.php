<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('companies')) {
            Schema::create('companies', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('code')->unique();
                $table->timestamps();
            });
        } else {
            Schema::table('companies', function (Blueprint $table) {
                if (!Schema::hasColumn('companies', 'name')) {
                    $table->string('name')->unique();
                }
                if (!Schema::hasColumn('companies', 'code')) {
                    $table->string('code')->unique();
                }
            });
            try { \DB::statement('CREATE UNIQUE INDEX companies_name_unique ON companies(name)'); } catch (\Throwable $e) {}
            try { \DB::statement('CREATE UNIQUE INDEX companies_code_unique ON companies(code)'); } catch (\Throwable $e) {}
        }
    }

    public function down(): void
    {
    }
};
