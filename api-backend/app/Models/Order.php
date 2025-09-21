<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'product_id',
        'qty',
        'unit_price',
        'total',
        'passenger_name',
        'passenger_doc',
        'passenger_national_id',
        'passenger_passport_no',
        'passenger_nationality',
        'passenger_email',
        'passenger_phone',
        'seats',
        'pnr',
        'status',
    ];

    protected $casts = [
        'seats'      => 'array',
        'qty'        => 'integer',
        'unit_price' => 'decimal:2',
        'total'      => 'decimal:2',
    ];

    // İlişkiler
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withDefault();
    }

    // OrderItem modelin varsa (opsiyonel)
    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
