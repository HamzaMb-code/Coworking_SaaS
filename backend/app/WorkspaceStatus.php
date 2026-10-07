<?php

namespace App;

enum WorkspaceStatus : string
{
    case PENDING = 'pending';
    case ACTIVE = 'active';
    case SUSPENDED = 'suspended';
}
