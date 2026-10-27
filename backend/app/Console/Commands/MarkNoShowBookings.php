<?php

namespace App\Console\Commands;

use App\Services\BookingService;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class MarkNoShowBookings extends Command
{
    protected $signature = 'bookings:mark-no-shows';

    protected $description = 'Mark confirmed bookings that ended without check-in as no-show';

    public function handle(BookingService $bookingService, NotificationService $notificationService): int
    {
        $marked = $bookingService->markNoShows($notificationService);
        $this->info("Marked {$marked} booking(s) as no-show.");

        return self::SUCCESS;
    }
}
