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
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'amount' => $this->amount,
            'status' => $this->status,
            'payment_method' => $this->payment_method,
            'transaction_reference' => $this->transaction_reference,
            'paid_at' => $this->paid_at,
            'booking' => $this->whenLoaded('booking', function () {
                $booking = $this->getRelation('booking');

                return [
                    'id' => $booking->id,
                    'start_at' => $booking->start_at,
                    'end_at' => $booking->end_at,
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
