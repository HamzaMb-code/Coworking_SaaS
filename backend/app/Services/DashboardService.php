<?php

namespace App\Services;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Resource;
use App\Models\WorkspaceMember;
use App\Models\Workspace;
use App\ResourceStatus;

class DashboardService
{
    public function getDashboard(Workspace $workspace): array
    {
        $bookings = Booking::where(
            'workspace_id',
            $workspace->id
        );

        $resources = Resource::where(
            'workspace_id',
            $workspace->id
        );

        $members = WorkspaceMember::where('workspace_id', $workspace->id);

        return [
            'bookings' => [
                'total' => (clone $bookings)->count(),

                'pending' => (clone $bookings)
                    ->where('status', BookingStatus::PENDING)
                    ->count(),

                'confirmed' => (clone $bookings)
                    ->where('status', BookingStatus::CONFIRMED)
                    ->count(),

                'checked_in' => (clone $bookings)
                    ->where('status', BookingStatus::CHECKED_IN)
                    ->count(),

                'completed' => (clone $bookings)
                    ->where('status', BookingStatus::COMPLETED)
                    ->count(),

                'cancelled' => (clone $bookings)
                    ->where('status', BookingStatus::CANCELLED)
                    ->count(),
            ],

            'revenue' => [
                'total' => (clone $bookings)
                    ->where('status', BookingStatus::COMPLETED)
                    ->sum('total_price'),

                'current_period' => (clone $bookings)
                    ->where('status', BookingStatus::COMPLETED)
                    ->whereBetween('updated_at', [now()->startOfMonth(), now()->endOfMonth()])
                    ->sum('total_price'),
            ],

            'resources' => [
                'total' => (clone $resources)->count(),

                'active' => (clone $resources)
                    ->where('status', ResourceStatus::ACTIVE)
                    ->count(),
            ],

            'today' => [
                'bookings' => (clone $bookings)
                    ->whereDate('start_at', today())
                    ->count(),
            ],

            'members' => [
                'total' => (clone $members)->count(),
            ],

            'recent_bookings' => (clone $bookings)
                ->with(['user', 'resource'])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(5)
                ->get(),
        ];
    }
}
