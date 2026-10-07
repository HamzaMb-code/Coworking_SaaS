<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\WorkspaceMemberRole;

class WorkspaceMemberPolicy
{
    /**
     * Can the user view the members of this workspace?
     */
    public function viewAny(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    /**
     * Can the user view a specific member?
     */
    public function view(
        User $user,
        WorkspaceMember $workspaceMember
    ): bool {
        return $workspaceMember->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    /**
     * Can the user add a new member to this workspace?
     */
    public function create(User $user, Workspace $workspace): bool
    {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }

    /**
     * Can the user modify this member?
     */
    public function update(
        User $user,
        WorkspaceMember $workspaceMember
    ): bool {
        return $workspaceMember->workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }

    /**
     * Can the user remove this member?
     */
    public function delete(
        User $user,
        WorkspaceMember $workspaceMember
    ): bool {
        // An owner cannot be removed.
        if ($workspaceMember->role === WorkspaceMemberRole::OWNER) {
            return false;
        }

        return $workspaceMember->workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }
}
