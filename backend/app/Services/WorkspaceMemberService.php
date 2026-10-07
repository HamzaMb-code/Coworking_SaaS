<?php

namespace App\Services;

use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Validation\ValidationException;

class WorkspaceMemberService
{
    public function create(
        Workspace $workspace,
        array $data
    ): WorkspaceMember {
        $alreadyMember = $workspace->members()
            ->where('user_id', $data['user_id'])
            ->exists();

        if ($alreadyMember) {
            throw ValidationException::withMessages([
                'user_id' => 'This user is already a member of this workspace.',
            ]);
        }

        return $workspace->members()->create($data);
    }

    public function update(
        WorkspaceMember $workspaceMember,
        array $data
    ): WorkspaceMember {
        $workspaceMember->update($data);

        return $workspaceMember->refresh();
    }

    public function delete(
        WorkspaceMember $workspaceMember
    ): void {
        $workspaceMember->delete();
    }
}