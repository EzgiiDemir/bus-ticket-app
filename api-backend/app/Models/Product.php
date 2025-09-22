<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Auth;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'trip','company_name','terminal_from','terminal_to','departure_time','cost',
        'capacity_reservation','is_active','note','user_id','created_by','updated_by',
        'company_id','duration','route','bus_type','important_notes','cancellation_policy',
    ];

    protected $casts = [
        'departure_time' => 'datetime:Y-m-d\TH:i',
        'is_active' => 'boolean',
        'cost' => 'decimal:2',
        'route' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $m) {
            $uid = Auth::id();
            if ($uid && empty($m->created_by)) $m->created_by = $uid;
            if ($uid) $m->updated_by = $uid;
        });

        static::updating(function (self $m) {
            $uid = Auth::id();
            if ($uid) $m->updated_by = $uid;
        });
    }

    // -- İlişkiler --
    public function user()    { return $this->belongsTo(User::class); }
    public function company() { return $this->belongsTo(Company::class); }
    public function orders()  { return $this->hasMany(Order::class); }

    public function creator()
    {
        $fk = $this->creatorForeignKey();
        return $this->belongsTo(User::class, $fk);
    }

    protected function creatorForeignKey(): string
    {
        if (Schema::hasColumn($this->getTable(), 'created_by'))  return 'created_by';
        if (Schema::hasColumn($this->getTable(), 'personnel_id')) return 'personnel_id';
        return Schema::hasColumn($this->getTable(), 'user_id') ? 'user_id' : 'created_by';
    }
}
