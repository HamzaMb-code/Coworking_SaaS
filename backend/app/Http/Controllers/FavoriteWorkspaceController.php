<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FavoriteWorkspaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspaces = $request->user()->favoriteWorkspaces()
            ->where('status', 'active')
            ->withCount(['resources as available_resources_count' => fn ($query) =>
                $query->where('status', 'active')
            ])
            ->orderBy('name')
            ->get();

        return response()->json(['workspaces' => $workspaces]);
    }

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        Gate::authorize('view', $workspace);
        $request->user()->favoriteWorkspaces()->syncWithoutDetaching([$workspace->id]);

        return response()->json(['message' => 'Workspace added to favorites.']);
    }

    public function destroy(Request $request, Workspace $workspace): JsonResponse
    {
        $request->user()->favoriteWorkspaces()->detach($workspace->id);

        return response()->json(['message' => 'Workspace removed from favorites.']);
    }
}
