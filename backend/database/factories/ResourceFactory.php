<?php

namespace Database\Factories;

use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

class ResourceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'type' => fake()->randomElement([
                ResourceType::DESK,
                ResourceType::MEETING_ROOM,
                ResourceType::PRIVATE_OFFICE,
                ResourceType::EVENT_SPACE,
            ]),
            'capacity' => fake()->numberBetween(1, 20),
            'price' => fake()->randomFloat(2, 50, 1000),
            'pricing_unit' => fake()->randomElement([
                PricingUnit::HOUR,
                PricingUnit::DAY,
                PricingUnit::MONTH,
            ]),
            'status' => ResourceStatus::ACTIVE,
        ];
    }
}
