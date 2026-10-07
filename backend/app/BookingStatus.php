<?php

namespace App;

enum BookingStatus: string
{
    case PENDING = 'pending';
    case CONFIRMED = 'confirmed';
    case CHECKED_IN = 'checked_in';
    case CANCELLED = 'cancelled';
    case COMPLETED = 'completed';
}
