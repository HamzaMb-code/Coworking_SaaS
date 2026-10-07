<?php

namespace App\Services;

use App\Models\Resource;
use App\Models\Workspace;

class ResourceService
{
    public function create(
        Workspace $workspace,
        array $data
    ): Resource {
        return $workspace->resources()->create($data);
    }

    public function update(
        Resource $resource,
        array $data
    ): Resource {
        $resource->update($data);

        return $resource->fresh();
    }

    public function delete(Resource $resource): void
    {
        $resource->delete();
    }
}