<?php

namespace Database\Factories;

use App\BookingStatus;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

class BookingFactory extends Factory
{
    public function definition(): array
    {
        $startAt = fake()->dateTimeBetween('now', '+30 days');
        $endAt = (clone $startAt)->modify('+2 hours');

        return [
            'user_id' => User::factory(),
            'workspace_id' => Workspace::factory(),
            'resource_id' => Resource::factory(),
            'start_at' => $startAt,
            'end_at' => $endAt,
            'status' => BookingStatus::CONFIRMED,
            'price' => fake()->randomFloat(2, 50, 1000),
        ];
    }
}