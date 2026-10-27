<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkspaceInvitationRequest;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Services\WorkspaceInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class WorkspaceInvitationController extends Controller
{
    public function __construct(
        private WorkspaceInvitationService $workspaceInvitationService
    ) {}

    public function store(
        StoreWorkspaceInvitationRequest $request,
        Workspace $workspace
    ): JsonResponse {
        Gate::authorize(
            'create',
            [\App\Models\WorkspaceInvitation::class, $workspace]
        );

        $invitation = $this->workspaceInvitationService->create(
            $workspace,
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'message' => $invitation->email_sent
                ? 'Invitation sent successfully.'
                : 'Invitation created, but its email could not be delivered. The invitation is available in the invitee’s account once they sign in.',
            'invitation' => $invitation,
        ], 201);
    }

    public function mine(): JsonResponse
    {
        $invitations = $this->workspaceInvitationService->pendingFor(
            request()->user()->email
        );

        return response()->json(['invitations' => $invitations]);
    }

    public function workspaceIndex(Workspace $workspace): JsonResponse
    {
        Gate::authorize(
            'create',
            [\App\Models\WorkspaceInvitation::class, $workspace]
        );

        $invitations = $workspace->invitations()
            ->whereNull('accepted_at')
            ->whereNull('declined_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->get();

        $responses = $workspace->invitations()
            ->with('responder:id,name,email')
            ->where('invited_by', request()->user()->id)
            ->whereNull('response_dismissed_at')
            ->where(function ($query) {
                $query->whereNotNull('accepted_at')
                    ->orWhereNotNull('declined_at');
            })
            ->latest('updated_at')
            ->limit(50)
            ->get();

        return response()->json([
            'invitations' => $invitations,
            'responses' => $responses,
        ]);
    }

    public function markResponsesRead(Workspace $workspace): JsonResponse
    {
        Gate::authorize(
            'create',
            [\App\Models\WorkspaceInvitation::class, $workspace]
        );

        $updated = $workspace->invitations()
            ->where('invited_by', request()->user()->id)
            ->whereNull('response_dismissed_at')
            ->whereNull('response_read_at')
            ->where(function ($query) {
                $query->whereNotNull('accepted_at')
                    ->orWhereNotNull('declined_at');
            })
            ->update(['response_read_at' => now()]);

        return response()->json([
            'message' => 'Invitation responses marked as read.',
            'updated_count' => $updated,
        ]);
    }

    public function dismissResponse(Workspace $workspace, int $invitation): JsonResponse
    {
        Gate::authorize(
            'create',
            [WorkspaceInvitation::class, $workspace]
        );

        $updated = $workspace->invitations()
            ->whereKey($invitation)
            ->where('invited_by', request()->user()->id)
            ->where(function ($query) {
                $query->whereNotNull('accepted_at')
                    ->orWhereNotNull('declined_at');
            })
            ->update([
                'response_dismissed_at' => now(),
                'response_read_at' => now(),
            ]);

        if (!$updated) {
            return response()->json(['message' => 'Invitation response not found.'], 404);
        }

        return response()->json(['message' => 'Invitation response removed from this list.']);
    }


    public function show(string $token): JsonResponse
    {
        $invitation = $this->workspaceInvitationService
            ->findValidInvitation($token);

        return response()->json([
            'invitation' => [
                'workspace' => $invitation->workspace->name,
                'workspace_id' => $invitation->workspace_id,
                'email' => $invitation->email,
                'role' => $invitation->role->value,
                'expires_at' => $invitation->expires_at,
            ],
        ]);
    }


    public function accept(
        string $token
    ): JsonResponse {
        $member = $this->workspaceInvitationService->accept(
            $token,
            request()->user()
        );

        return response()->json([
            'message' => 'Invitation accepted successfully.',
            'member' => $member,
        ]);
    }

    public function decline(string $token): JsonResponse
    {
        $invitation = $this->workspaceInvitationService->decline(
            $token,
            request()->user()
        );

        return response()->json([
            'message' => 'Invitation declined.',
            'invitation' => $invitation,
        ]);
    }
}
