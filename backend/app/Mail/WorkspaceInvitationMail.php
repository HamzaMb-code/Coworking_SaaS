<?php

namespace App\Mail;

use App\Models\WorkspaceInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class WorkspaceInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public WorkspaceInvitation $invitation
    ) {}

    public function build()
    {
        $url = config('app.frontend_url')
            . '/invitations/'
            . $this->invitation->token;

        return $this
            ->to($this->invitation->email)
            ->subject(
                'You have been invited to join '
                . $this->invitation->workspace->name
            )
            ->html("
                <h1>You're invited!</h1>

                <p>
                    You have been invited to join
                    <strong>{$this->invitation->workspace->name}</strong>
                    as
                    <strong>{$this->invitation->role->value}</strong>.
                </p>

                <p>
                    <a href=\"{$url}\">
                        Review invitation
                    </a>
                </p>

                <p>
                    This invitation expires on
                    {$this->invitation->expires_at->format('Y-m-d H:i')}.
                </p>
            ");
    }
}
