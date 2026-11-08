<?php

namespace Tests\Feature;

use App\Models\Resource;
use App\Models\Workspace;
use App\Services\CloudinaryImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CloudinaryImageDeliveryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.cloudinary.cloud_name' => 'delivery-test',
            'services.cloudinary.api_key' => 'test-api-key',
            'services.cloudinary.api_secret' => 'test-api-secret',
        ]);
    }

    public function test_sdk_builds_automatic_format_and_quality_delivery_urls_without_modifying_the_asset(): void
    {
        $service = new CloudinaryImageService();
        $publicId = 'coworking/workspaces/original';

        $deliveryUrl = $service->deliveryUrl($publicId);
        $responsiveUrl = $service->responsiveDeliveryUrl($publicId, 640);

        $this->assertStringContainsString('/image/upload/f_auto/q_auto/v1/coworking/workspaces/original', $deliveryUrl);
        $this->assertStringContainsString('/image/upload/c_limit,w_640/f_auto/q_auto/v1/coworking/workspaces/original', $responsiveUrl);
    }

    public function test_model_image_urls_use_optimized_cloudinary_delivery_and_keep_legacy_local_urls_unchanged(): void
    {
        Storage::fake('public');
        $workspace = Workspace::factory()->create([
            'cloudinary_url' => 'https://res.cloudinary.com/delivery-test/image/upload/v1/coworking/workspaces/original.jpg',
            'image_public_id' => 'coworking/workspaces/original',
        ]);
        $resource = Resource::factory()->create([
            'workspace_id' => $workspace->id,
            'cloudinary_url' => null,
            'image_public_id' => null,
            'image_path' => 'resources/legacy.jpg',
        ]);

        $this->assertStringContainsString('/f_auto/q_auto/', $workspace->image_url);
        $this->assertSame(Storage::disk('public')->url('resources/legacy.jpg'), $resource->image_url);
    }
}
