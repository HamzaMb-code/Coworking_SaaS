<?php

namespace App\Http\Requests;

use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'image' => [
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],

            'type' => [
                'required',
                Rule::enum(ResourceType::class),
            ],

            'capacity' => [
                'required',
                'integer',
                'min:1',
            ],

            'price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'pricing_unit' => [
                'required',
                Rule::enum(PricingUnit::class),
            ],

            'status' => [
                'sometimes',
                Rule::enum(ResourceStatus::class),
            ],
        ];
    }
}
