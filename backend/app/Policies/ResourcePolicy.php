<?php

namespace App\Policies;

use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\WorkspaceMemberRole;

class ResourcePolicy
{
    public function viewAny(
        User $user,
        Workspace $workspace
    ): bool {
        if ($workspace->status->value === 'active') {
            return true;
        }

        return $workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function view(
        User $user,
        Resource $resource
    ): bool {
        if ($resource->workspace->status->value === 'active') {
            return true;
        }

        return $resource->workspace->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                WorkspaceMemberRole::OWNER,
                WorkspaceMemberRole::STAFF,
            ])
            ->exists();
    }

    public function create(
        User $user,
        Workspace $workspace
    ): bool {
        return $workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }

    public function update(
        User $user,
        Resource $resource
    ): bool {
        return $resource->workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }

    public function delete(
        User $user,
        Resource $resource
    ): bool {
        return $resource->workspace->members()
            ->where('user_id', $user->id)
            ->where('role', WorkspaceMemberRole::OWNER)
            ->exists();
    }
}
