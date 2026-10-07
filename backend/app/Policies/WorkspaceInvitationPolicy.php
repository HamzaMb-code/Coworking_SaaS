<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;
use App\WorkspaceMemberRole;

class WorkspaceInvitationPolicy
{
    public function create(
        User $user,
        Workspace $workspace
    ): bool {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }
}