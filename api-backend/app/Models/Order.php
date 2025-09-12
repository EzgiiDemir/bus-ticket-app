<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id','product_id','qty','unit_price','total',
        'passenger_name','passenger_email','passenger_phone','pnr','status'
    ];

    protected $casts = [
        'qty' => 'integer',
        'unit_price' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function product() { return $this->belongsTo(Product::class); }
}
