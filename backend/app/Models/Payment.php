<?php

namespace App\Models;

use App\PaymentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'amount',
        'status',
        'payment_method',
        'transaction_reference',
        'paid_at',
        'payment_date',
        'submitted_at',
        'bank_name',
        'proof_path',
        'verified_by',
        'verified_at',
        'rejection_reason',
        'receipt_number',
        'receipt_path',
        'idempotency_key',
        'refunded_at',
        'refunded_by',
        'refund_reference',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => PaymentStatus::class,
            'paid_at' => 'datetime',
            'payment_date' => 'date',
            'submitted_at' => 'datetime',
            'verified_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function refundVerifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by');
    }
}
