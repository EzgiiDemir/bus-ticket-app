<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

// app/Models/RoleRequest.php
class RoleRequest extends Model
{
    protected $fillable = [
        'user_id','company_id','role',
        'company_status','admin_status',
        'company_note','admin_note',
        'company_decided_by','admin_decided_by',
        // legacy:
        'type','status','note','reviewed_by','reviewed_at',
    ];

    public function user(){ return $this->belongsTo(User::class); }
    public function company(){ return $this->belongsTo(\App\Models\Company::class); }
}
