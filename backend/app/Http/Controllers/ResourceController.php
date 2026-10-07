<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreResourceRequest;
use App\Http\Requests\UpdateResourceRequest;
use App\Models\Resource;
use App\Models\Workspace;
use App\Services\ResourceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ResourceController extends Controller
{
    public function __construct(
        private ResourceService $resourceService
    ) {}

    public function index(Workspace $workspace): JsonResponse
    {
        Gate::authorize(
            'viewAny',
            [Resource::class, $workspace]
        );

        $isManager = $workspace->members()
            ->where('user_id', request()->user()->id)
            ->whereIn('role', ['owner', 'staff'])
            ->exists();

        $resources = $workspace->resources()
            ->when(! $isManager, fn ($query) => $query->where('status', 'active'))
            ->get();

        return response()->json([
            'resources' => $resources,
        ]);
    }

    public function store(
        StoreResourceRequest $request,
        Workspace $workspace
    ): JsonResponse {
        Gate::authorize(
            'create',
            [Resource::class, $workspace]
        );

        $resource = $this->resourceService->create(
            $workspace,
            $request->validated()
        );

        return response()->json([
            'message' => 'Resource created successfully.',
            'resource' => $resource,
        ], 201);
    }

    public function show(
        Workspace $workspace,
        Resource $resource
    ): JsonResponse {
        Gate::authorize('view', $resource);

        return response()->json([
            'resource' => $resource,
        ]);
    }

    public function update(
        UpdateResourceRequest $request,
        Workspace $workspace,
        Resource $resource
    ): JsonResponse {
        Gate::authorize('update', $resource);

        $resource = $this->resourceService->update(
            $resource,
            $request->validated()
        );

        return response()->json([
            'message' => 'Resource updated successfully.',
            'resource' => $resource,
        ]);
    }

    public function destroy(
        Workspace $workspace,
        Resource $resource
    ): JsonResponse {
        Gate::authorize('delete', $resource);

        $this->resourceService->delete($resource);

        return response()->json([
            'message' => 'Resource deleted successfully.',
        ]);
    }
}
