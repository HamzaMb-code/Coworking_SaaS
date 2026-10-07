<?php

namespace App;

enum ResourceType: string
{
    case DESK = 'desk';
    case MEETING_ROOM = 'meeting_room';
    case PRIVATE_OFFICE = 'private_office';
    case EVENT_SPACE = 'event_space';
}
