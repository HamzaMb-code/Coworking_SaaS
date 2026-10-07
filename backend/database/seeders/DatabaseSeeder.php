<?php

namespace Database\Seeders;

use App\BookingStatus;
use App\PlatformRole;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\WorkspaceMemberRole;
use App\WorkspaceStatus;
use App\Models\Booking;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Admin
        $admin = User::factory()->create([
            'name' => 'System Admin',
            'email' => 'admin@coworking.test',
            'password' => Hash::make('password'),
            'platform_role' => PlatformRole::ADMIN,
        ]);

        // Create users
        $users = User::factory(10)->create();

        // Create workspaces
        $workspaces = Workspace::factory(3)->create();

        foreach ($workspaces as $workspace) {

            // Create members
            $members = $users->random(4);

            foreach ($members as $user) {
                WorkspaceMember::create([
                    'user_id' => $user->id,
                    'workspace_id' => $workspace->id,
                    'role' => fake()->randomElement([
                        WorkspaceMemberRole::STAFF,
                        WorkspaceMemberRole::CUSTOMER,
                    ]),
                ]);
            }

            // Create resources
            $resources = Resource::factory(5)->create([
                'workspace_id' => $workspace->id,
            ]);

            // Create bookings for resources
            foreach ($resources as $resource) {

                $bookingUsers = $users->random(2);

                foreach ($bookingUsers as $user) {
                    $startAt = fake()->dateTimeBetween('now', '+30 days');
                    $endAt = (clone $startAt)->modify('+2 hours');

                    Booking::create([
                        'user_id' => $user->id,
                        'workspace_id' => $workspace->id,
                        'resource_id' => $resource->id,
                        'start_at' => $startAt,
                        'end_at' => $endAt,
                        'status' => BookingStatus::CONFIRMED,
                        'price' => fake()->randomFloat(2, 50, 500),
                    ]);
                }
            }
        }
    }
}