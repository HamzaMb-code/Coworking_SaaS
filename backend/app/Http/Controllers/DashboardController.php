<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingResource;
use App\Models\Workspace;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class DashboardController extends Controller
{
    /**
     * Display the workspace dashboard.
     */
    public function index(
        Workspace $workspace,
        DashboardService $dashboardService
    ): JsonResponse {
        Gate::authorize('viewDashboard', $workspace);

        $dashboard = $dashboardService->getDashboard($workspace);

        $dashboard['recent_bookings'] = BookingResource::collection(
            $dashboard['recent_bookings']
        );

        return response()->json([
            'dashboard' => $dashboard,
        ]);
    }
}
