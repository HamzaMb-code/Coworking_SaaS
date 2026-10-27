<?php

namespace App;

enum BookingStatus: string
{
    case PENDING = 'pending';
    case CONFIRMED = 'confirmed';
    case CHECKED_IN = 'checked_in';
    case CHECKED_OUT = 'checked_out';
    case CANCELLED = 'cancelled';
    case REJECTED = 'rejected';
    case NO_SHOW = 'no_show';
    case COMPLETED = 'completed';
}
