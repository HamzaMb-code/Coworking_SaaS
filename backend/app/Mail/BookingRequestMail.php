<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking) {}

    public function build(): static
    {
        return $this
            ->subject('New booking request for ' . $this->booking->workspace->name)
            ->view('emails.booking-request', [
                'booking' => $this->booking,
                'reviewUrl' => rtrim(config('app.frontend_url'), '/')
                    . '/workspaces/' . $this->booking->workspace_id . '/bookings',
            ]);
    }
}
