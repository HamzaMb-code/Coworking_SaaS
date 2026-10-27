<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingLifecycleEvent extends Model
{
    protected $fillable = ['booking_id', 'actor_id', 'event', 'details', 'occurred_at'];

    protected function casts(): array
    {
        return ['details' => 'array', 'occurred_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
