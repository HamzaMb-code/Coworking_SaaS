<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        'payment_deadline_at',
        'payment_method',
        'checked_in_at',
        'checked_out_at',
        'status',
        'total_price',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'payment_deadline_at' => 'datetime',
            'checked_in_at' => 'datetime',
            'checked_out_at' => 'datetime',
            'status' => BookingStatus::class,
            'total_price' => 'decimal:2',
        ];
    }

    public function isOverdue(): bool
    {
        return $this->status === BookingStatus::CHECKED_IN
            && now()->greaterThan($this->end_at);
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


    /** The newest payment attempt, retained for older booking clients. */
    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    /** All submitted, approved, failed, and refunded payment records. */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function lifecycleEvents(): HasMany
    {
        return $this->hasMany(BookingLifecycleEvent::class)->orderBy('occurred_at');
    }
}
