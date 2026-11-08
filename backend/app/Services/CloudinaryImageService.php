<?php

namespace App\Services;

use Cloudinary\Cloudinary;
use Cloudinary\Transformation\Delivery;
use Cloudinary\Transformation\Format;
use Cloudinary\Transformation\Quality;
use Cloudinary\Transformation\Resize;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class CloudinaryImageService
{
    public const WORKSPACE_FOLDER = 'coworking/workspaces';

    public const RESOURCE_FOLDER = 'coworking/resources';

    private ?Cloudinary $cloudinary = null;

    /** @return array{secure_url: string, public_id: string} */
    public function upload(UploadedFile $image, string $folder): array
    {
        try {
            $result = $this->client()->uploadApi()->upload($image->getRealPath(), [
                'folder' => $folder,
                'resource_type' => 'image',
            ]);

            $secureUrl = $result['secure_url'] ?? null;
            $publicId = $result['public_id'] ?? null;
            if (($result['error'] ?? null) || ! is_string($secureUrl) || ! is_string($publicId)) {
                throw new RuntimeException('Cloudinary did not return a valid uploaded image.');
            }

            return ['secure_url' => $secureUrl, 'public_id' => $publicId];
        } catch (Throwable $exception) {
            Log::error('Cloudinary image upload failed.', [
                'folder' => $folder,
                'exception' => $exception,
            ]);

            throw $exception;
        }
    }

    /** Build an optimized delivery URL without changing the stored original asset. */
    public function deliveryUrl(string $publicId): string
    {
        return (string) $this->client()->image($publicId)
            ->delivery(Delivery::format(Format::auto()))
            ->delivery(Delivery::quality(Quality::auto()));
    }

    /** Build one width-limited derivative URL for a responsive srcset candidate. */
    public function responsiveDeliveryUrl(string $publicId, int $width): string
    {
        return (string) $this->client()->image($publicId)
            ->resize(Resize::limitFit($width))
            ->delivery(Delivery::format(Format::auto()))
            ->delivery(Delivery::quality(Quality::auto()));
    }

    /** Best-effort deletion; a Cloudinary outage must not undo a saved database update. */
    public function delete(?string $publicId): bool
    {
        if (! $publicId) {
            return true;
        }

        try {
            $result = $this->client()->uploadApi()->destroy($publicId, ['invalidate' => true]);
            $status = $result['result'] ?? null;
            if (in_array($status, ['ok', 'not found'], true)) {
                return true;
            }

            Log::warning('Cloudinary image deletion was not confirmed.', [
                'public_id' => $publicId,
                'result' => $status,
            ]);

            return false;
        } catch (Throwable $exception) {
            Log::warning('Cloudinary image deletion failed.', [
                'public_id' => $publicId,
                'exception' => $exception,
            ]);

            return false;
        }
    }

    /** Delete the Cloudinary asset, or a legacy public-disk image when no public ID exists. */
    public function deletePrevious(?string $publicId, ?string $imagePath): void
    {
        if ($publicId) {
            $this->delete($publicId);

            return;
        }

        if ($imagePath) {
            try {
                if (! Storage::disk('public')->delete($imagePath)) {
                    Log::warning('Legacy public image deletion was not confirmed.', ['image_path' => $imagePath]);
                }
            } catch (Throwable $exception) {
                Log::warning('Legacy public image deletion failed.', [
                    'image_path' => $imagePath,
                    'exception' => $exception,
                ]);
            }
        }
    }

    private function client(): Cloudinary
    {
        if ($this->cloudinary) {
            return $this->cloudinary;
        }

        return $this->cloudinary = new Cloudinary([
            'cloud' => [
                'cloud_name' => config('services.cloudinary.cloud_name'),
                'api_key' => config('services.cloudinary.api_key'),
                'api_secret' => config('services.cloudinary.api_secret'),
            ],
            'url' => ['secure' => true],
        ]);
    }
}
