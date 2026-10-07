<?php

namespace App\Http\Requests;

use App\WorkspaceMemberRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkspaceInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => [
                'required',
                'email',
                'max:255',
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