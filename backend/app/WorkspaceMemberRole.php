<?php

namespace App;

enum WorkspaceMemberRole: string
{
    case OWNER = 'owner';
    case STAFF = 'staff';
    case CUSTOMER = 'customer';
}
