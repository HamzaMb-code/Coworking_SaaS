<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class WorkspaceActivityNotification extends Notification
{
    /** @param array<string, int|string|null> $metadata */
    public function __construct(
        public readonly string $event,
        public readonly string $title,
        public readonly string $message,
        public readonly string $url,
        public readonly array $metadata = [],
    ) {}

    /** @return array<string, mixed> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return [
            'event' => $this->event,
            'title' => $this->title,
            'message' => $this->message,
            'url' => $this->url,
            ...$this->metadata,
        ];
    }
}
