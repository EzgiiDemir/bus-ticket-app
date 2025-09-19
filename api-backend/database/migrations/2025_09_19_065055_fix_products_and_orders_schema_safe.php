<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // PRODUCTS
        Schema::table('products', function (Blueprint $t) {
            if (!Schema::hasColumn('products','user_id')) $t->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            if (!Schema::hasColumn('products','company_id')) $t->foreignId('company_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
            if (!Schema::hasColumn('products','trip')) $t->string('trip')->after('company_id');
            if (!Schema::hasColumn('products','company_name')) $t->string('company_name')->after('trip');
            if (!Schema::hasColumn('products','terminal_from')) $t->string('terminal_from')->after('company_name');
            if (!Schema::hasColumn('products','terminal_to')) $t->string('terminal_to')->after('terminal_from');
            if (!Schema::hasColumn('products','departure_time')) $t->dateTime('departure_time')->after('terminal_to');
            if (!Schema::hasColumn('products','cost')) $t->decimal('cost',10,2)->default(0)->after('departure_time');
            if (!Schema::hasColumn('products','capacity_reservation')) $t->integer('capacity_reservation')->default(0)->after('cost');
            if (!Schema::hasColumn('products','is_active')) $t->boolean('is_active')->default(true)->after('capacity_reservation');
            if (!Schema::hasColumn('products','note')) $t->text('note')->nullable()->after('is_active');
            if (!Schema::hasColumn('products','created_by')) $t->string('created_by')->nullable()->after('note');
            if (!Schema::hasColumn('products','updated_by')) $t->string('updated_by')->nullable()->after('created_by');
            $t->index(['user_id','company_id'],'products_user_company_idx');
            $t->index(['departure_time'],'products_departure_time_idx');
            $t->index(['is_active'],'products_is_active_idx');
        });

        Schema::table('orders', function (Blueprint $t) {
            if (!Schema::hasColumn('orders','user_id')) $t->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            if (!Schema::hasColumn('orders','product_id')) $t->foreignId('product_id')->nullable()->after('user_id')->constrained('products')->nullOnDelete();
            if (!Schema::hasColumn('orders','qty')) $t->integer('qty')->default(1)->after('product_id');
            if (!Schema::hasColumn('orders','unit_price')) $t->decimal('unit_price',10,2)->default(0)->after('qty');
            if (!Schema::hasColumn('orders','total')) $t->decimal('total',10,2)->default(0)->after('unit_price');
            if (!Schema::hasColumn('orders','pnr')) $t->string('pnr',16)->unique()->after('total');
            if (!Schema::hasColumn('orders','status')) $t->string('status',32)->default('paid')->after('pnr');
            if (!Schema::hasColumn('orders','passenger_name')) $t->string('passenger_name')->nullable()->after('status');
            if (!Schema::hasColumn('orders','passenger_email')) $t->string('passenger_email')->nullable()->after('passenger_name');
            if (!Schema::hasColumn('orders','passenger_phone')) $t->string('passenger_phone',32)->nullable()->after('passenger_email');
            $t->index(['product_id','created_at'],'orders_product_created_idx');
            $t->index(['user_id','created_at'],'orders_user_created_idx');
        });
    }

    public function down(): void
    {
    }
};
