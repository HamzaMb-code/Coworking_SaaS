<?php

namespace App\Console\Commands;

use App\Services\BookingService;
use Illuminate\Console\Command;

class ExpirePendingBookings extends Command
{
    protected $signature = 'bookings:expire-payment-holds';

    protected $description = 'Release unpaid pending bookings after their payment deadline';

    public function handle(BookingService $bookingService): int
    {
        $expired = $bookingService->expirePendingPaymentHolds();
        $this->info("Expired {$expired} booking(s).");

        return self::SUCCESS;
    }
}
