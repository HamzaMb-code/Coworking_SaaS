<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasOne;
use App\BookingStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'workspace_id',
        'resource_id',
        'start_at',
        'end_at',
        'status',
        'total_price',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'status' => BookingStatus::class,
            'total_price' => 'decimal:2',
        ];
    }

    /**
     * The user who made the booking.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The workspace where the booking takes place.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class)->withTrashed();
    }

    /**
     * The resource being booked.
     */
    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }


    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }
}
