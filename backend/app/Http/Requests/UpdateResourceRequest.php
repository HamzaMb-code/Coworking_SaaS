<?php

namespace App\Http\Requests;

use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'sometimes',
                'string',
                'max:255',
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'type' => [
                'sometimes',
                Rule::enum(ResourceType::class),
            ],

            'capacity' => [
                'sometimes',
                'integer',
                'min:1',
            ],

            'price' => [
                'sometimes',
                'numeric',
                'min:0',
            ],

            'pricing_unit' => [
                'sometimes',
                Rule::enum(PricingUnit::class),
            ],

            'status' => [
                'sometimes',
                Rule::enum(ResourceStatus::class),
            ],
        ];
    }
}