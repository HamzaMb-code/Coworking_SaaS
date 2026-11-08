<?php

namespace Tests\Feature;

use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\CloudinaryImageService;
use App\WorkspaceMemberRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class ResourceImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $images = Mockery::mock(CloudinaryImageService::class)->makePartial();
        $counter = 0;
        $images->shouldReceive('upload')->andReturnUsing(function () use (&$counter) {
            self::assertSame(CloudinaryImageService::RESOURCE_FOLDER, func_get_arg(1));
            $counter++;
            return ['secure_url' => "https://res.cloudinary.com/test/image/upload/resource-{$counter}.jpg", 'public_id' => "resource-{$counter}"];
        });
        $images->shouldReceive('deliveryUrl')->andReturnUsing(fn (string $publicId) => "https://res.cloudinary.com/test/image/upload/f_auto/q_auto/v1/{$publicId}");
        $images->shouldReceive('delete')->andReturnTrue();
        $this->app->instance(CloudinaryImageService::class, $images);
    }

    public function test_owner_can_create_replace_and_remove_a_resource_image(): void
    {
        Storage::fake('public');
        [$owner, $workspace] = $this->ownerWorkspace();

        $created = $this->actingAs($owner)->post("/api/workspaces/{$workspace->id}/resources", [
            'name' => 'Window Desk',
            'type' => 'desk',
            'capacity' => 1,
            'price' => 90,
            'pricing_unit' => 'day',
            'image' => $this->validImageUpload('desk.webp'),
        ])->assertCreated()->assertJsonPath('resource.type', 'desk');

        $resourceId = $created->json('resource.id');
        $oldPath = $created->json('resource.image_public_id');
        $this->assertSame('resource-1', $oldPath);
        $this->assertSame('https://res.cloudinary.com/test/image/upload/f_auto/q_auto/v1/resource-1', $created->json('resource.image_url'));

        $replacement = $this->post("/api/workspaces/{$workspace->id}/resources/{$resourceId}", [
            '_method' => 'PUT',
            'image' => $this->validImageUpload('new-desk.webp'),
        ])->assertOk();

        $newPath = $replacement->json('resource.image_public_id');
        $this->assertNotSame($oldPath, $newPath);
        $this->assertSame('resource-2', $newPath);

        $this->post("/api/workspaces/{$workspace->id}/resources/{$resourceId}", [
            '_method' => 'PUT',
            'remove_image' => '1',
        ])->assertOk()->assertJsonPath('resource.image_url', null);

        $this->assertDatabaseHas('resources', ['id' => $resourceId, 'image_path' => null]);
        $this->assertDatabaseHas('resources', ['id' => $resourceId, 'cloudinary_url' => null, 'image_public_id' => null]);
    }

    public function test_resource_image_is_optional_and_invalid_uploads_are_rejected(): void
    {
        Storage::fake('public');
        [$owner, $workspace] = $this->ownerWorkspace();

        $this->actingAs($owner)->post("/api/workspaces/{$workspace->id}/resources", [
            'name' => 'Quiet Room',
            'type' => 'meeting_room',
            'capacity' => 6,
            'price' => 180,
            'pricing_unit' => 'hour',
        ])->assertCreated()->assertJsonPath('resource.image_url', null);

        $this->post("/api/workspaces/{$workspace->id}/resources", [
            'name' => 'Bad Upload',
            'type' => 'desk',
            'capacity' => 1,
            'price' => 40,
            'pricing_unit' => 'day',
            'image' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
        ])->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_only_workspace_owners_can_create_resources_with_images(): void
    {
        Storage::fake('public');
        $staff = User::factory()->create();
        $workspace = Workspace::factory()->create();
        WorkspaceMember::create([
            'workspace_id' => $workspace->id,
            'user_id' => $staff->id,
            'role' => WorkspaceMemberRole::STAFF,
        ]);

        $this->actingAs($staff)->post("/api/workspaces/{$workspace->id}/resources", [
            'name' => 'Desk',
            'type' => 'desk',
            'capacity' => 1,
            'price' => 50,
            'pricing_unit' => 'day',
            'image' => $this->validImageUpload('desk.webp'),
        ])->assertForbidden();

        $this->assertSame(0, Resource::query()->count());
    }

    public function test_resource_image_url_falls_back_to_legacy_local_path(): void
    {
        Storage::fake('public');
        $resource = Resource::factory()->create([
            'image_path' => 'resources/legacy.jpg',
            'cloudinary_url' => null,
            'image_public_id' => null,
        ]);

        $this->assertSame(Storage::disk('public')->url('resources/legacy.jpg'), $resource->image_url);
    }

    /** @return array{User, Workspace} */
    private function ownerWorkspace(): array
    {
        $owner = User::factory()->create();
        $workspace = Workspace::factory()->create();
        WorkspaceMember::create([
            'workspace_id' => $workspace->id,
            'user_id' => $owner->id,
            'role' => WorkspaceMemberRole::OWNER,
        ]);

        return [$owner, $workspace];
    }

    private function validImageUpload(string $name): UploadedFile
    {
        return new UploadedFile(
            base_path('../frontend/public/images/coworking_spaces.webp'),
            $name,
            'image/webp',
            null,
            true,
        );
    }
}
