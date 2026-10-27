<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payment_method' => ['prohibited'],
            'resource_id' => [
                'sometimes',
                'integer',
                'exists:resources,id',
            ],

            'start_at' => [
                'sometimes',
                'date',
                'after:now',
            ],

            'end_at' => [
                'sometimes',
                'date',
                'after:start_at',
            ],
        ];
    }
}
