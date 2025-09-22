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
        'seats',        // JSON dizi
        'pnr',
        'status',
    ];

    protected $casts = [
        'seats'      => 'array',
        'qty'        => 'integer',
        'unit_price' => 'decimal:2',
        'total'      => 'decimal:2',
    ];

    // API çıktısına normalize alan ekle
    protected $appends = ['seat_numbers'];

    // ------- İlişkiler -------
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withDefault();
    }

    // OrderItem var ise
    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    // ------- Scopes -------
    public function scopeForProduct($q, int $productId)
    {
        return $q->where('product_id', $productId);
    }

    // ------- Accessor/Mutator: seat_numbers -------
    public function getSeatNumbersAttribute()
    {
        // seats kolonu JSON array ise onu döndür
        if (!empty($this->attributes['seats'])) {
            $v = $this->attributes['seats'];
            if (is_string($v)) {
                $decoded = json_decode($v, true);
                return json_last_error() === JSON_ERROR_NONE ? $decoded : $v;
            }
            return $v;
        }
        // Eski şema desteği: seat_numbers kolonu varsa
        if (array_key_exists('seat_numbers', $this->attributes)) {
            $v = $this->attributes['seat_numbers'];
            $decoded = json_decode($v, true);
            return json_last_error() === JSON_ERROR_NONE ? $decoded : $v;
        }
        return [];
    }

    public function setSeatNumbersAttribute($value)
    {
        // Dışarıdan seat_numbers set edilirse seats’e yaz
        $this->attributes['seats'] = is_array($value) ? json_encode($value) : $value;
    }
}
