<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('role_requests')) {
            Schema::create('role_requests', function (Blueprint $t) {
                $t->id();
                $t->foreignId('user_id')->constrained()->cascadeOnDelete();
                $t->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
                $t->string('role')->default('personnel');
                $t->enum('company_status', ['pending','approved','rejected'])->default('pending');
                $t->enum('admin_status',   ['pending','approved','rejected'])->default('pending');
                $t->text('company_note')->nullable();
                $t->text('admin_note')->nullable();
                $t->foreignId('company_decided_by')->nullable()->constrained('users')->nullOnDelete();
                $t->foreignId('admin_decided_by')->nullable()->constrained('users')->nullOnDelete();
                $t->timestamps();
                $t->unique(['user_id','role']);
            });
        } else {
            Schema::table('role_requests', function (Blueprint $t) {
                if (!Schema::hasColumn('role_requests','company_id'))       $t->foreignId('company_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
                if (!Schema::hasColumn('role_requests','role'))             $t->string('role')->default('personnel')->after('company_id');
                if (!Schema::hasColumn('role_requests','company_status'))   $t->enum('company_status',['pending','approved','rejected'])->default('pending')->after('role');
                if (!Schema::hasColumn('role_requests','admin_status'))     $t->enum('admin_status',['pending','approved','rejected'])->default('pending')->after('company_status');
                if (!Schema::hasColumn('role_requests','company_note'))     $t->text('company_note')->nullable()->after('admin_status');
                if (!Schema::hasColumn('role_requests','admin_note'))       $t->text('admin_note')->nullable()->after('company_note');
                if (!Schema::hasColumn('role_requests','company_decided_by'))$t->foreignId('company_decided_by')->nullable()->after('admin_note')->constrained('users')->nullOnDelete();
                if (!Schema::hasColumn('role_requests','admin_decided_by')) $t->foreignId('admin_decided_by')->nullable()->after('company_decided_by')->constrained('users')->nullOnDelete();
            });
        }

        // users tablosu role_status alanı
        Schema::table('users', function (Blueprint $t) {
            if (!Schema::hasColumn('users','company_id'))  $t->foreignId('company_id')->nullable()->after('id')->constrained()->nullOnDelete();
            if (!Schema::hasColumn('users','role'))        $t->string('role')->default('passenger')->after('email');
            if (!Schema::hasColumn('users','role_status')) $t->enum('role_status',['pending','company_approved','active','rejected'])->default('pending')->after('role');
        });
    }

    public function down(): void {
        // Geri alma basit: yeni kolonları bırak
        if (Schema::hasTable('role_requests')) {
            Schema::table('role_requests', function (Blueprint $t) {
                foreach (['company_decided_by','admin_decided_by','admin_note','company_note','admin_status','company_status','role','company_id'] as $c) {
                    if (Schema::hasColumn('role_requests',$c)) $t->dropColumn($c);
                }
            });
        }
        Schema::table('users', function (Blueprint $t) {
            if (Schema::hasColumn('users','role_status')) $t->dropColumn('role_status');
            if (Schema::hasColumn('users','role'))        $t->dropColumn('role');
            if (Schema::hasColumn('users','company_id'))  $t->dropConstrainedForeignId('company_id');
        });
    }
};
