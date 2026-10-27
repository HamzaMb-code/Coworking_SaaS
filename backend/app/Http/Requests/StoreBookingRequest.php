<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creatingBooking = $this->isMethod('post') && !str_ends_with($this->path(), '/bookings/quote');
        return [
            'customer_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'resource_id' => [
                'required',
                'integer',
                'exists:resources,id',
            ],

            'start_at' => [
                'required',
                'date',
                'after:now',
            ],

            'end_at' => [
                'required',
                'date',
                'after:start_at',
            ],
            'payment_method' => [$creatingBooking ? 'required' : 'sometimes', Rule::in(['bank_transfer', 'cash'])],
        ];
    }
}
