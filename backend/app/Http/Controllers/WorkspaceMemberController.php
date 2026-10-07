<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkspaceMemberRequest;
use App\Http\Requests\UpdateWorkspaceMemberRequest;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\WorkspaceMemberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class WorkspaceMemberController extends Controller
{
    public function __construct(
        private WorkspaceMemberService $workspaceMemberService
    ) {}

    public function index(Workspace $workspace): JsonResponse
    {
        Gate::authorize(
            'viewAny',
            [WorkspaceMember::class, $workspace]
        );

        $members = $workspace->members()
            ->with('user')
            ->get();

        return response()->json([
            'members' => $members,
        ]);
    }

    public function store(
        StoreWorkspaceMemberRequest $request,
        Workspace $workspace
    ): JsonResponse {
        Gate::authorize(
            'create',
            [WorkspaceMember::class, $workspace]
        );

        $member = $this->workspaceMemberService->create(
            $workspace,
            $request->validated()
        );

        return response()->json([
            'message' => 'Member added successfully.',
            'member' => $member->load('user'),
        ], 201);
    }

    public function show(
        Workspace $workspace,
        WorkspaceMember $workspaceMember
    ): JsonResponse {
        Gate::authorize('view', $workspaceMember);

        return response()->json([
            'member' => $workspaceMember->load('user'),
        ]);
    }

    public function update(
        UpdateWorkspaceMemberRequest $request,
        Workspace $workspace,
        WorkspaceMember $workspaceMember
    ): JsonResponse {
        Gate::authorize('update', $workspaceMember);

        $member = $this->workspaceMemberService->update(
            $workspaceMember,
            $request->validated()
        );

        return response()->json([
            'message' => 'Member updated successfully.',
            'member' => $member->load('user'),
        ]);
    }

    public function destroy(
        Workspace $workspace,
        WorkspaceMember $workspaceMember
    ): JsonResponse {
        Gate::authorize('delete', $workspaceMember);

        $this->workspaceMemberService->delete($workspaceMember);

        return response()->json([
            'message' => 'Member removed successfully.',
        ]);
    }
}