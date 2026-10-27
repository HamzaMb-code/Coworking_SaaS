<?php

namespace App\Services;

use App\Models\Resource;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ResourceService
{
    public function create(
        Workspace $workspace,
        array $data
    ): Resource {
        $image = $data['image'] ?? null;
        unset($data['image'], $data['remove_image']);

        if ($image instanceof UploadedFile) {
            $data['image_path'] = $image->store('resources', 'public');
        }

        try {
            return $workspace->resources()->create($data);
        } catch (Throwable $exception) {
            if (! empty($data['image_path'])) {
                Storage::disk('public')->delete($data['image_path']);
            }

            throw $exception;
        }
    }

    public function update(
        Resource $resource,
        array $data
    ): Resource {
        $oldImagePath = $resource->image_path;
        $image = $data['image'] ?? null;
        $removeImage = (bool) ($data['remove_image'] ?? false);
        unset($data['image'], $data['remove_image']);

        $newImagePath = null;
        if ($image instanceof UploadedFile) {
            $newImagePath = $image->store('resources', 'public');
            $data['image_path'] = $newImagePath;
        } elseif ($removeImage) {
            $data['image_path'] = null;
        }

        try {
            $resource->update($data);
        } catch (Throwable $exception) {
            if ($newImagePath) {
                Storage::disk('public')->delete($newImagePath);
            }

            throw $exception;
        }

        if ($oldImagePath && ($newImagePath || $removeImage)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $resource->fresh();
    }

    public function delete(Resource $resource): void
    {
        $imagePath = $resource->image_path;
        $resource->delete();

        if ($imagePath) {
            Storage::disk('public')->delete($imagePath);
        }
    }
}
