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
use App\Services\CloudinaryImageService;
use App\WorkspaceMemberRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class WorkspaceDeletionAndImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $images = Mockery::mock(CloudinaryImageService::class)->makePartial();
        $counter = 0;
        $images->shouldReceive('upload')->andReturnUsing(function () use (&$counter) {
            self::assertSame(CloudinaryImageService::WORKSPACE_FOLDER, func_get_arg(1));
            $counter++;
            return ['secure_url' => "https://res.cloudinary.com/test/image/upload/space-{$counter}.jpg", 'public_id' => "space-{$counter}"];
        });
        $images->shouldReceive('deliveryUrl')->andReturnUsing(fn (string $publicId) => "https://res.cloudinary.com/test/image/upload/f_auto/q_auto/v1/{$publicId}");
        $images->shouldReceive('delete')->andReturnTrue();
        $this->app->instance(CloudinaryImageService::class, $images);
    }

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
        $this->assertNull($response->json('workspace.image_path'));
        $this->assertSame('space-1', $response->json('workspace.image_public_id'));
        $this->assertSame('https://res.cloudinary.com/test/image/upload/f_auto/q_auto/v1/space-1', $response->json('workspace.image_url'));
    }

    public function test_invalid_image_format_and_file_over_ten_megabytes_are_rejected(): void
    {
        $owner = User::factory()->create();
        $base = ['name' => 'Invalid Image', 'slug' => 'invalid-image', 'address' => '1 Main St', 'city' => 'Rabat'];

        $this->actingAs($owner)->post('/api/workspaces', [...$base, 'image' => UploadedFile::fake()->create('image.svg', 5, 'image/svg+xml')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');

        $this->actingAs($owner)->post('/api/workspaces', [...$base, 'slug' => 'large-image', 'image' => self::pngUpload('large.png')->size(10241)], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_ten_megabyte_workspace_images_are_accepted_on_create_and_update(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $base = ['name' => 'Large Image', 'slug' => 'large-image-valid', 'address' => '1 Main St', 'city' => 'Rabat'];

        $createUpload = self::pngUpload('large.png')->size(10240);
        $createResponse = $this->actingAs($owner)->post('/api/workspaces', [...$base, 'image' => $createUpload], ['Accept' => 'application/json'])->assertCreated();
        $workspaceId = $createResponse->json('workspace.id');
        $createPath = $createResponse->json('workspace.image_public_id');
        $this->assertSame('space-1', $createPath);

        $updateUpload = self::pngUpload('larger.png')->size(10240);
        $updateResponse = $this->actingAs($owner)->post("/api/workspaces/{$workspaceId}", ['_method' => 'PUT', 'image' => $updateUpload], ['Accept' => 'application/json'])->assertOk();
        $updatePath = $updateResponse->json('workspace.image_public_id');

        $this->assertNotSame($createPath, $updatePath);
        $this->assertSame('space-2', $updatePath);
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
        $newPath = $workspace->fresh()->image_public_id;
        $this->assertSame('space-1', $newPath);
        Storage::disk('public')->assertMissing('workspaces/old.jpg');

        $this->actingAs($owner)->post("/api/workspaces/{$workspace->id}", ['_method' => 'PUT', 'remove_image' => '1'], ['Accept' => 'application/json'])->assertOk();
        $this->assertNull($workspace->fresh()->image_path);
        $this->assertNull($workspace->fresh()->image_public_id);
    }

    public function test_workspace_image_url_falls_back_to_legacy_local_path(): void
    {
        Storage::fake('public');
        $workspace = Workspace::factory()->create([
            'image_path' => 'workspaces/legacy.jpg',
            'cloudinary_url' => null,
            'image_public_id' => null,
        ]);

        $this->assertSame(Storage::disk('public')->url('workspaces/legacy.jpg'), $workspace->image_url);
        $this->assertNull(Workspace::factory()->create(['image_path' => null])->image_url);
    }

    public function test_failed_workspace_update_removes_the_new_cloudinary_upload_and_keeps_old_reference(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::factory()->create([
            'image_public_id' => 'legacy-cloud-id',
            'cloudinary_url' => 'https://res.cloudinary.com/test/old.jpg',
        ]);
        WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => WorkspaceMemberRole::OWNER]);

        $images = Mockery::mock(CloudinaryImageService::class)->makePartial();
        $images->shouldReceive('upload')->once()->andReturn([
            'secure_url' => 'https://res.cloudinary.com/test/new.jpg',
            'public_id' => 'new-cloud-id',
        ]);
        $images->shouldReceive('delete')->once()->with('new-cloud-id')->andReturnTrue();
        $this->app->instance(CloudinaryImageService::class, $images);

        Workspace::updating(function () {
            return false;
        });

        $this->actingAs($owner)->post("/api/workspaces/{$workspace->id}", [
            '_method' => 'PUT',
            'image' => self::pngUpload('replacement.png'),
        ], ['Accept' => 'application/json'])->assertInternalServerError();

        $this->assertSame('legacy-cloud-id', $workspace->fresh()->image_public_id);
        $this->assertSame('https://res.cloudinary.com/test/old.jpg', $workspace->fresh()->cloudinary_url);
    }

    public function test_cloudinary_upload_failure_does_not_create_a_workspace(): void
    {
        $owner = User::factory()->create();
        $images = Mockery::mock(CloudinaryImageService::class)->makePartial();
        $images->shouldReceive('upload')->once()->andThrow(new \RuntimeException('Cloudinary unavailable.'));
        $images->shouldNotReceive('delete');
        $this->app->instance(CloudinaryImageService::class, $images);

        $this->actingAs($owner)->post('/api/workspaces', [
            'name' => 'Upload Failure',
            'slug' => 'upload-failure',
            'address' => '1 Main St',
            'city' => 'Rabat',
            'image' => self::pngUpload('image.png'),
        ], ['Accept' => 'application/json'])->assertInternalServerError();

        $this->assertDatabaseMissing('workspaces', ['slug' => 'upload-failure']);
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
