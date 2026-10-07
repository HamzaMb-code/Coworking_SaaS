<?php

namespace Database\Factories;

use App\WorkspaceMemberRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkspaceMemberFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'workspace_id' => Workspace::factory(),
            'role' => fake()->randomElement([
                WorkspaceMemberRole::STAFF,
                WorkspaceMemberRole::CUSTOMER,
            ]),
        ];
    }
}