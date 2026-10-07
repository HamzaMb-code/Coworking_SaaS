<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;
use App\PlatformRole;
use App\WorkspaceMemberRole;

class WorkspacePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Workspace $workspace): bool
    {
        if ($workspace->status->value === 'active') {
            return true;
        }

        return $workspace->members()
            ->where('user_id', $user->id)
            ->exists();
    }

    public function create(User $user): bool
    {
        return $user->platform_role === PlatformRole::USER;
    }

    public function createForCustomer(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [WorkspaceMemberRole::OWNER, WorkspaceMemberRole::STAFF])
            ->exists();
    }

    public function book(User $user, Workspace $workspace): bool
    {
        return $workspace->status->value === 'active';
    }

    public function update(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }

    public function delete(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }


    public function viewDashboard(
        User $user,
        Workspace $workspace
    ): bool {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }
}
