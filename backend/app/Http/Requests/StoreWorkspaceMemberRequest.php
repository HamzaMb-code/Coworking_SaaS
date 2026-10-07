<?php

namespace App\Http\Requests;

use App\WorkspaceMemberRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkspaceMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => [
                'required',
                'integer',
                'exists:users,id',
            ],

            'role' => [
                'required',
                Rule::in([
                    WorkspaceMemberRole::STAFF->value,
                    WorkspaceMemberRole::CUSTOMER->value,
                ]),
            ],
        ];
    }
}
