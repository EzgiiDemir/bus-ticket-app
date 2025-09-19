<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'trip','company_name','terminal_from','terminal_to',
        'departure_time','cost','capacity_reservation','is_active',
        'note','user_id','created_by','updated_by','company_id'
    ];

    protected $casts = [
        'departure_time' => 'datetime:Y-m-d\TH:i',
        'is_active' => 'boolean',
        'cost' => 'decimal:2',
    ];

    public function user(){ return $this->belongsTo(User::class); }
    public function company(){ return $this->belongsTo(Company::class); }


}
