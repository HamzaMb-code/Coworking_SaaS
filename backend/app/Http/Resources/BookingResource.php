<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            'start_at' => $this->start_at,
            'end_at' => $this->end_at,

            'total_price' => $this->total_price,
            'status' => $this->status,
            'payment_status' => $this->whenLoaded('payment', fn () => $this->payment?->status?->value),
            'payment' => $this->whenLoaded('payment', fn () => $this->payment ? [
                'id' => $this->payment->id,
                'amount' => $this->payment->amount,
                'status' => $this->payment->status->value,
                'payment_method' => $this->payment->payment_method,
                'paid_at' => $this->payment->paid_at,
            ] : null),

            'user' => $this->whenLoaded('user', function () {
                $user = $this->getRelation('user');

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ];
            }),

            'resource' => $this->whenLoaded('resource', function () {
                $resource = $this->getRelation('resource');

                return [
                    'id' => $resource->id,
                    'name' => $resource->name,
                    'type' => $resource->type,
                ];
            }),

            'workspace' => $this->whenLoaded('workspace', function () {
                $workspace = $this->getRelation('workspace');

                return [
                    'id' => $workspace->id,
                    'name' => $workspace->name,
                    'city' => $workspace->city,
                ];
            }),
        ];
    }
}
