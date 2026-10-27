<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $manual = $this->input('payment_method') === 'bank_transfer';
        return [
            // Card checkout is not an available payment method. Existing
            // provider records/webhooks remain readable for historical data.
            'payment_method' => ['required', Rule::in(['bank_transfer'])],
            'amount' => [$manual ? 'required' : 'sometimes', 'numeric', 'gt:0', 'decimal:0,2'],
            'payment_date' => [$manual ? 'required' : 'sometimes', 'date_format:Y-m-d', 'before_or_equal:today'],
            'bank_name' => ['required_if:payment_method,bank_transfer', 'nullable', 'string', 'max:120'],
            'transaction_reference' => ['nullable', 'string', 'max:255'],
            'proof' => ['required_if:payment_method,bank_transfer', 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ];
    }
}
