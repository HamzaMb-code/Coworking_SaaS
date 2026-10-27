<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'payment_method' => ['sometimes', Rule::in(['bank_transfer'])],
            'amount' => ['sometimes', 'numeric', 'gt:0', 'decimal:0,2'],
            'payment_date' => ['sometimes', 'date_format:Y-m-d', 'before_or_equal:today'],
            'bank_name' => ['required_if:payment_method,bank_transfer', 'nullable', 'string', 'max:120'],
            'transaction_reference' => ['nullable', 'string', 'max:255'],
            'proof' => ['sometimes', 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ];
    }
}
