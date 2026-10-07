<?php

namespace App;

enum PricingUnit: string
{
    case HOUR = 'hour';
    case DAY = 'day';
    case MONTH = 'month';
}
