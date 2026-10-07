<?php

namespace App\Services;


use App\Models\User;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\DB;
use App\Mail\WorkspaceInvitationMail;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;
use Illuminate\Validation\ValidationException;

class WorkspaceInvitationService
{
    public function create(
        Workspace $workspace,
        array $data
    ): WorkspaceInvitation {
        $alreadyMember = $workspace->members()
            ->whereHas('user', function ($query) use ($data) {
                $query->where('email', $data['email']);
            })
            ->exists();

        if ($alreadyMember) {
            throw ValidationException::withMessages([
                'email' => 'This user is already a member of this workspace.',
            ]);
        }

        $pendingInvitation = $workspace->invitations()
            ->where('email', $data['email'])
            ->whereNull('accepted_at')
            ->whereNull('declined_at')
            ->where('expires_at', '>', now())
            ->exists();

        if ($pendingInvitation) {
            throw ValidationException::withMessages([
                'email' => 'A pending invitation already exists for this email.',
            ]);
        }

        // Create the invitation
        $invitation = $workspace->invitations()->create([
            'email' => $data['email'],
            'role' => $data['role'],
            'token' => Str::random(64),
            'expires_at' => now()->addDays(7),
        ]);

        // Email delivery is separate from creating an in-app invitation. A
        // missing local SMTP service must not make the already-created invite
        // look like the whole operation failed.
        try {
            Mail::to($invitation->email)
                ->send(new WorkspaceInvitationMail($invitation));
            $invitation->setAttribute('email_sent', true);
        } catch (Throwable $exception) {
            Log::warning('Workspace invitation email could not be delivered.', [
                'invitation_id' => $invitation->id,
                'workspace_id' => $workspace->id,
                'email' => $invitation->email,
                'exception' => $exception->getMessage(),
            ]);
            $invitation->setAttribute('email_sent', false);
        }

        return $invitation;
    }



    public function findValidInvitation(string $token): WorkspaceInvitation
{
    $invitation = WorkspaceInvitation::with('workspace')
        ->where('token', $token)
        ->first();

    if (!$invitation) {
        throw ValidationException::withMessages([
            'token' => 'Invalid invitation.',
        ]);
    }

    if ($invitation->accepted_at) {
        throw ValidationException::withMessages([
            'token' => 'This invitation has already been accepted.',
        ]);
    }

    if ($invitation->declined_at) {
        throw ValidationException::withMessages([
            'token' => 'This invitation has been declined.',
        ]);
    }

    if ($invitation->expires_at->isPast()) {
        throw ValidationException::withMessages([
            'token' => 'This invitation has expired.',
        ]);
    }

    return $invitation;
}

public function pendingFor(string $email)
{
    return WorkspaceInvitation::query()
        ->with('workspace:id,name,city,address')
        ->where('email', $email)
        ->whereNull('accepted_at')
        ->whereNull('declined_at')
        ->where('expires_at', '>', now())
        ->latest()
        ->get();
}

public function decline(string $token, User $user): WorkspaceInvitation
{
    return DB::transaction(function () use ($token, $user) {
        $invitation = WorkspaceInvitation::query()
            ->where('token', $token)
            ->lockForUpdate()
            ->first();

        if (!$invitation) {
            throw ValidationException::withMessages(['token' => 'Invalid invitation.']);
        }

        if ($invitation->accepted_at || $invitation->declined_at) {
            throw ValidationException::withMessages(['token' => 'This invitation has already been answered.']);
        }

        if ($invitation->expires_at->isPast()) {
            throw ValidationException::withMessages(['token' => 'This invitation has expired.']);
        }

        if ($user->email !== $invitation->email) {
            throw ValidationException::withMessages(['email' => 'This invitation was sent to a different email address.']);
        }

        $invitation->update(['declined_at' => now()]);

        return $invitation->fresh('workspace');
    });
}



public function accept(
    string $token,
    User $user
): WorkspaceMember {
    return DB::transaction(function () use ($token, $user) {

        $invitation = WorkspaceInvitation::query()
            ->where('token', $token)
            ->lockForUpdate()
            ->first();

        if (!$invitation) {
            throw ValidationException::withMessages([
                'token' => 'Invalid invitation.',
            ]);
        }

        if ($invitation->accepted_at) {
            throw ValidationException::withMessages([
                'token' => 'This invitation has already been accepted.',
            ]);
        }

        if ($invitation->declined_at) {
            throw ValidationException::withMessages([
                'token' => 'This invitation has been declined.',
            ]);
        }

        if ($invitation->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'token' => 'This invitation has expired.',
            ]);
        }

        if ($user->email !== $invitation->email) {
            throw ValidationException::withMessages([
                'email' => 'This invitation was sent to a different email address.',
            ]);
        }

        $alreadyMember = WorkspaceMember::query()
            ->where('user_id', $user->id)
            ->where('workspace_id', $invitation->workspace_id)
            ->exists();

        if ($alreadyMember) {
            throw ValidationException::withMessages([
                'invitation' => 'You are already a member of this workspace.',
            ]);
        }

        $member = WorkspaceMember::create([
            'user_id' => $user->id,
            'workspace_id' => $invitation->workspace_id,
            'role' => $invitation->role->value,
        ]);

        $invitation->update([
            'accepted_at' => now(),
        ]);

        return $member;
    });
}
}
