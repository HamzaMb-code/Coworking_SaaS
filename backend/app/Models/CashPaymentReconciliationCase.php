<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashPaymentReconciliationCase extends Model
{
    protected $fillable = [
        'booking_id', 'workspace_id', 'staff_user_id', 'amount', 'idempotency_key', 'reason',
        'status', 'resolved_by', 'resolved_at', 'resolution_notes',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'resolved_at' => 'datetime'];
    }

    public function booking(): BelongsTo { return $this->belongsTo(Booking::class); }
    public function workspace(): BelongsTo { return $this->belongsTo(Workspace::class); }
    public function staffMember(): BelongsTo { return $this->belongsTo(User::class, 'staff_user_id'); }
    public function resolver(): BelongsTo { return $this->belongsTo(User::class, 'resolved_by'); }
}
