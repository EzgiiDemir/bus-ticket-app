<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SeatHold extends Model
{
    protected $fillable = ['reservation_id','product_id','seat','user_id','expires_at'];
    protected $casts = ['expires_at'=>'datetime'];
}
