<?php

namespace App\Models;

use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Resource extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'name',
        'description',
        'type',
        'capacity',
        'price',
        'pricing_unit',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'type' => ResourceType::class,
            'pricing_unit' => PricingUnit::class,
            'status' => ResourceStatus::class,
            'capacity' => 'integer',
            'price' => 'decimal:2',
        ];
    }

    /**
     * The workspace this resource belongs to.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * The bookings for this resource.
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}