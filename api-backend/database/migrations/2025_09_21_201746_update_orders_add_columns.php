<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders','product_id')) {
                $table->foreignId('product_id')->after('id')->constrained()->cascadeOnDelete();
            }
            if (!Schema::hasColumn('orders','qty')) {
                $table->unsignedInteger('qty')->default(1)->after('product_id');
            }
            if (!Schema::hasColumn('orders','unit_price')) {
                $table->decimal('unit_price',10,2)->default(0)->after('qty');
            }
            if (!Schema::hasColumn('orders','total')) {
                $table->decimal('total',10,2)->default(0)->after('unit_price');
            }
            if (!Schema::hasColumn('orders','passenger_name')) {
                $table->string('passenger_name')->after('total');
            }
            if (!Schema::hasColumn('orders','passenger_doc')) {
                $table->string('passenger_doc',20)->nullable()->after('passenger_name');
            }
            if (!Schema::hasColumn('orders','passenger_national_id')) {
                $table->string('passenger_national_id',30)->nullable()->after('passenger_doc');
            }
            if (!Schema::hasColumn('orders','passenger_passport_no')) {
                $table->string('passenger_passport_no',50)->nullable()->after('passenger_national_id');
            }
            if (!Schema::hasColumn('orders','passenger_nationality')) {
                $table->string('passenger_nationality',5)->nullable()->after('passenger_passport_no');
            }
            if (!Schema::hasColumn('orders','seats')) {
                $table->json('seats')->nullable()->after('passenger_nationality');
            }
            if (!Schema::hasColumn('orders','pnr')) {
                $table->string('pnr',12)->unique()->after('seats');
            }
        });
    }

    public function down(): void {
        Schema::table('orders', function (Blueprint $table) {
            foreach ([
                         'pnr','seats','passenger_nationality','passenger_passport_no',
                         'passenger_national_id','passenger_doc','passenger_name',
                         'total','unit_price','qty',
                     ] as $col) {
                if (Schema::hasColumn('orders',$col)) $table->dropColumn($col);
            }
            if (Schema::hasColumn('orders','product_id')) {
                $table->dropConstrainedForeignId('product_id');
            }
        });
    }
};
