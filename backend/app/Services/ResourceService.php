<?php

namespace App\Services;

use App\Models\Resource;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use RuntimeException;
use Throwable;

class ResourceService
{
    public function __construct(private CloudinaryImageService $images) {}

    public function create(
        Workspace $workspace,
        array $data
    ): Resource {
        $image = $data['image'] ?? null;
        unset($data['image'], $data['remove_image']);

        if ($image instanceof UploadedFile) {
            $uploadedImage = $this->images->upload($image, CloudinaryImageService::RESOURCE_FOLDER);
            $data['cloudinary_url'] = $uploadedImage['secure_url'];
            $data['image_public_id'] = $uploadedImage['public_id'];
            $data['image_path'] = null;
        } else {
            $uploadedImage = null;
        }

        try {
            return $workspace->resources()->create($data);
        } catch (Throwable $exception) {
            if ($uploadedImage) {
                $this->images->delete($uploadedImage['public_id']);
            }

            throw $exception;
        }
    }

    public function update(
        Resource $resource,
        array $data
    ): Resource {
        $oldImagePath = $resource->image_path;
        $oldPublicId = $resource->image_public_id;
        $image = $data['image'] ?? null;
        $removeImage = (bool) ($data['remove_image'] ?? false);
        unset($data['image'], $data['remove_image']);

        $uploadedImage = null;
        if ($image instanceof UploadedFile) {
            $uploadedImage = $this->images->upload($image, CloudinaryImageService::RESOURCE_FOLDER);
            $data['cloudinary_url'] = $uploadedImage['secure_url'];
            $data['image_public_id'] = $uploadedImage['public_id'];
            $data['image_path'] = null;
        } elseif ($removeImage) {
            $data['cloudinary_url'] = null;
            $data['image_public_id'] = null;
            $data['image_path'] = null;
        }

        try {
            if (! $resource->update($data)) {
                throw new \RuntimeException('Resource update was not saved.');
            }
        } catch (Throwable $exception) {
            if ($uploadedImage) {
                $this->images->delete($uploadedImage['public_id']);
            }

            throw $exception;
        }

        if ($uploadedImage || $removeImage) {
            $this->images->deletePrevious($oldPublicId, $oldImagePath);
        }

        return $resource->fresh();
    }

    public function delete(Resource $resource): void
    {
        $imagePath = $resource->image_path;
        $publicId = $resource->image_public_id;
        $resource->delete();

        $this->images->deletePrevious($publicId, $imagePath);
    }
}
