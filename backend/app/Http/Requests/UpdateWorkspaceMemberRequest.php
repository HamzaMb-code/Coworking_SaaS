<?php

namespace App\Http\Requests;

use App\WorkspaceMemberRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWorkspaceMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
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
