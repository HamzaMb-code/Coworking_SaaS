<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        $receiptAvailable = in_array($this->status, [\App\PaymentStatus::PAID, \App\PaymentStatus::REFUNDED], true)
            && (bool) $this->receipt_path;
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'amount' => $this->amount,
            'status' => $this->status,
            'payment_method' => $this->payment_method,
            'transaction_reference' => $this->transaction_reference,
            'paid_at' => $this->paid_at,
            'payment_date' => $this->payment_date?->format('Y-m-d'),
            'submitted_at' => $this->submitted_at,
            'bank_name' => $this->bank_name,
            'verified_by' => $this->verified_by,
            'verifier_name' => $this->whenLoaded('verifier', fn () => $this->verifier?->name),
            'verified_at' => $this->verified_at,
            'rejection_reason' => $this->rejection_reason,
            'receipt_number' => $this->receipt_number,
            'refunded_at' => $this->refunded_at,
            'refunded_by' => $this->refunded_by,
            'refund_reference' => $this->refund_reference,
            'refund_verifier_name' => $this->whenLoaded('refundVerifier', fn () => $this->refundVerifier?->name),
            'proof_available' => (bool) $this->proof_path,
            'receipt_available' => $receiptAvailable,
            'links' => [
                'proof' => $this->proof_path ? route('payments.proof', [$this->booking->workspace_id, $this->id]) : null,
                'receipt' => $receiptAvailable ? route('payments.receipt', [$this->booking->workspace_id, $this->id]) : null,
            ],
            'booking' => $this->whenLoaded('booking', function () {
                $booking = $this->getRelation('booking');
                $summary = app(\App\Services\PaymentService::class)->summary($booking);

                return [
                    'id' => $booking->id,
                    'status' => $booking->status?->value,
                    'start_at' => $booking->start_at,
                    'end_at' => $booking->end_at,
                    'total_price' => $booking->total_price,
                    'payment_method' => $booking->payment_method,
                    'verified_amount' => $summary['verified_amount'],
                    'outstanding_balance' => $summary['outstanding_balance'],
                    'fully_paid' => $summary['fully_paid'],
                    'customer' => $booking->relationLoaded('user') && $booking->user
                        ? ['id' => $booking->user->id, 'name' => $booking->user->name, 'email' => $booking->user->email]
                        : null,
                    'workspace' => $booking->relationLoaded('workspace') && $booking->workspace
                        ? ['id' => $booking->workspace->id, 'name' => $booking->workspace->name]
                        : null,
                    'resource' => $booking->relationLoaded('resource') && $booking->resource
                        ? ['id' => $booking->resource->id, 'name' => $booking->resource->name]
                        : null,
                ];
            }),
        ];
    }
}
