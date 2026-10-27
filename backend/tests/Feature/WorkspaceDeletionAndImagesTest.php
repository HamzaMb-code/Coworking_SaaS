<?php

namespace Tests\Feature;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\PaymentStatus;
use App\WorkspaceMemberRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorkspaceDeletionAndImagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_an_owner_can_soft_delete_a_workspace_and_history_is_preserved(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $staff = User::factory()->create();
        $customer = User::factory()->create();
        $workspace = Workspace::factory()->create(['image_path' => 'workspaces/space.jpg']);
        Storage::disk('public')->put('workspaces/space.jpg', 'image');
        WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => WorkspaceMemberRole::OWNER]);
        WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $staff->id, 'role' => WorkspaceMemberRole::STAFF]);
        $resource = Resource::factory()->create(['workspace_id' => $workspace->id]);
        $booking = Booking::create([
            'user_id' => $customer->id,
            'workspace_id' => $workspace->id,
            'resource_id' => $resource->id,
            'start_at' => now()->addDays(2),
            'end_at' => now()->addDays(2)->addHours(2),
            'status' => BookingStatus::CONFIRMED,
            'total_price' => 200,
        ]);
        Payment::create(['booking_id' => $booking->id, 'amount' => 100, 'status' => PaymentStatus::PAID, 'payment_method' => 'cash']);

        $this->actingAs($staff)->deleteJson("/api/workspaces/{$workspace->id}")->assertForbidden();
        $this->actingAs($customer)->deleteJson("/api/workspaces/{$workspace->id}")->assertForbidden();
        $this->assertNull($workspace->fresh()->deleted_at);

        $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}")->assertOk();

        $this->assertNotNull($workspace->fresh()->deleted_at);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id]);
        $this->assertDatabaseHas('payments', ['booking_id' => $booking->id]);
        $this->assertSame($workspace->id, $booking->fresh()->workspace->id);
        Storage::disk('public')->assertMissing('workspaces/space.jpg');
        $this->getJson('/api/workspaces')->assertOk()->assertJsonMissing(['id' => $workspace->id]);
        $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}")->assertNotFound();
        $this->actingAs($customer)->postJson("/api/workspaces/{$workspace->id}/bookings", [
            'resource_id' => $resource->id,
            'start_at' => now()->addDays(3)->setTime(10, 0)->toDateTimeString(),
            'end_at' => now()->addDays(3)->setTime(11, 0)->toDateTimeString(),
            'payment_method' => 'bank_transfer',
        ])->assertNotFound();
    }

    public function test_workspace_image_is_optional_and_uploaded_file_is_returned_by_api(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $base = ['name' => 'Image Optional', 'slug' => 'image-optional', 'address' => '1 Main St', 'city' => 'Rabat'];

        $this->actingAs($owner)->postJson('/api/workspaces', $base)
            ->assertCreated()->assertJsonPath('workspace.image_path', null)->assertJsonPath('workspace.image_url', null);

        $file = self::pngUpload('studio.png');
        $response = $this->actingAs($owner)->post('/api/workspaces', [
            ...$base, 'name' => 'Image Uploaded', 'slug' => 'image-uploaded', 'image' => $file,
        ], ['Accept' => 'application/json'])->assertCreated();
        $path = $response->json('workspace.image_path');
        $this->assertNotEmpty($path);
        Storage::disk('public')->assertExists($path);
        $this->assertNotEmpty($response->json('workspace.image_url'));
    }

    public function test_invalid_image_format_and_file_over_five_megabytes_are_rejected(): void
    {
        $owner = User::factory()->create();
        $base = ['name' => 'Invalid Image', 'slug' => 'invalid-image', 'address' => '1 Main St', 'city' => 'Rabat'];

        $this->actingAs($owner)->post('/api/workspaces', [...$base, 'image' => UploadedFile::fake()->create('image.svg', 5, 'image/svg+xml')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');

        $this->actingAs($owner)->post('/api/workspaces', [...$base, 'slug' => 'large-image', 'image' => UploadedFile::fake()->create('large.jpg', 5121, 'image/jpeg')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_owner_can_replace_or_remove_workspace_image_without_leaving_old_files(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $workspace = Workspace::factory()->create(['image_path' => 'workspaces/old.jpg']);
        WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => WorkspaceMemberRole::OWNER]);
        Storage::disk('public')->put('workspaces/old.jpg', 'old');

        $replacement = self::pngUpload('new.png');
        $this->actingAs($owner)->post("/api/workspaces/{$workspace->id}", ['_method' => 'PUT', 'image' => $replacement], ['Accept' => 'application/json'])->assertOk();
        $newPath = $workspace->fresh()->image_path;
        $this->assertNotSame('workspaces/old.jpg', $newPath);
        Storage::disk('public')->assertMissing('workspaces/old.jpg');
        Storage::disk('public')->assertExists($newPath);

        $this->actingAs($owner)->post("/api/workspaces/{$workspace->id}", ['_method' => 'PUT', 'remove_image' => '1'], ['Accept' => 'application/json'])->assertOk();
        $this->assertNull($workspace->fresh()->image_path);
        Storage::disk('public')->assertMissing($newPath);
    }

    public function test_favorites_endpoint_lists_active_workspaces_and_omits_soft_deleted_ones(): void
    {
        $customer = User::factory()->create();
        $activeWorkspace = Workspace::factory()->create();
        $deletedWorkspace = Workspace::factory()->create();
        $customer->favoriteWorkspaces()->attach([$activeWorkspace->id, $deletedWorkspace->id]);
        $deletedWorkspace->delete();

        $this->actingAs($customer)->getJson('/api/my-favorites')
            ->assertOk()
            ->assertJsonCount(1, 'workspaces')
            ->assertJsonPath('workspaces.0.id', $activeWorkspace->id);
    }

    private static function pngUpload(string $name): UploadedFile
    {
        $contents = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=', true);
        return UploadedFile::fake()->createWithContent($name, $contents === false ? '' : $contents);
    }
}
