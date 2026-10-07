<?php

namespace App\Http\Controllers;

use App\Services\PaymentService;
use App\Http\Resources\BookingResource;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Requests\UpdateBookingRequest;
use App\Models\Booking;
use App\Models\Workspace;
use App\Models\User;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;


class BookingController extends Controller
{
    public function customers(Workspace $workspace): JsonResponse
    {
        Gate::authorize('createForCustomer', $workspace);

        $managerIds = $workspace->members()
            ->whereIn('role', [\App\WorkspaceMemberRole::OWNER, \App\WorkspaceMemberRole::STAFF])
            ->select('user_id');

        return response()->json([
            'customers' => User::query()
                ->select('id', 'name', 'email')
                ->whereNotIn('id', $managerIds)
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function quote(
        \App\Http\Requests\StoreBookingRequest $request,
        Workspace $workspace,
        BookingService $bookingService
    ): JsonResponse {
        Gate::authorize('book', $workspace);

        $quote = $bookingService->quote($workspace, $request->validated());

        return response()->json([
            'total_price' => $quote['total_price'],
            'pricing_unit' => $quote['resource']->pricing_unit->value,
            'unit_price' => $quote['resource']->price,
        ]);
    }

    /** Display pending reservations for workspaces owned by the user. */
    public function notifications(): JsonResponse
    {
        $bookings = Booking::query()
            ->where('status', \App\BookingStatus::PENDING)
            ->whereHas('workspace.members', function ($query) {
                $query->where('user_id', request()->user()->id)
                    ->where('role', \App\WorkspaceMemberRole::OWNER);
            })
            ->with(['user', 'resource', 'workspace', 'payment'])
            ->latest()
            ->get();

        return response()->json([
            'notifications' => BookingResource::collection($bookings),
            'unread_count' => $bookings->count(),
        ]);
    }

    /** Display bookings made by the authenticated customer. */
    public function mine(): JsonResponse
    {
        $bookings = Booking::query()
            ->where('user_id', request()->user()->id)
            ->with(['user', 'resource', 'workspace', 'payment'])
            ->latest()
            ->get();

        return response()->json([
            'bookings' => BookingResource::collection($bookings),
        ]);
    }

    /**
     * Display all bookings for a workspace.
     */
    public function index(
        Workspace $workspace
    ): JsonResponse {
        Gate::authorize('viewAny', $workspace);

        $bookings = Booking::query()
            ->where('workspace_id', $workspace->id)
            ->with(['user', 'resource', 'workspace', 'payment'])
            ->latest()
            ->get();

        return response()->json([
            'bookings' => BookingResource::collection($bookings),
        ]);
    }

    /**
     * Create a new booking.
     */
    public function store(
        StoreBookingRequest $request,
        Workspace $workspace,
        BookingService $bookingService
    ): JsonResponse {
        Gate::authorize('book', $workspace);

        $data = $request->validated();
        $isManager = Gate::allows('createForCustomer', $workspace);
        $customerId = $data['customer_id'] ?? null;

        if ($isManager && ! $customerId) {
            throw ValidationException::withMessages([
                'customer_id' => 'Select a customer for this booking.',
            ]);
        }

        if (! $isManager && $customerId !== null) {
            Gate::authorize('createForCustomer', $workspace);
        }

        $customer = $customerId !== null
            ? User::query()->findOrFail($customerId)
            : $request->user();

        if ($customerId !== null && $workspace->members()
            ->where('user_id', $customer->id)
            ->whereIn('role', [\App\WorkspaceMemberRole::OWNER, \App\WorkspaceMemberRole::STAFF])
            ->exists()) {
            throw ValidationException::withMessages([
                'customer_id' => 'Choose a customer, not a workspace owner or staff member.',
            ]);
        }

        unset($data['customer_id']);

        $booking = $bookingService->create(
            $customer,
            $workspace,
            $data
        );
        $booking->load('payment');

        return response()->json([
            'message' => 'Booking created successfully.',
            'booking' => new BookingResource($booking),
        ], 201);
    }

    /**
     * Display a specific booking.
     */
    public function show(
        Workspace $workspace,
        Booking $booking
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('view', $booking);

        $booking->load(['user', 'resource', 'workspace', 'payment']);

        return response()->json([
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Update a booking.
     */
    public function update(
        UpdateBookingRequest $request,
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('update', $booking);

        $booking = $bookingService->update(
            $request->user(),
            $booking,
            $request->validated()
        );
        $booking->load('payment');

        return response()->json([
            'message' => 'Booking updated successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Confirm a booking.
     */
    public function confirm(
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('confirm', $booking);

        $booking = $bookingService->confirm($booking);

        return response()->json([
            'message' => 'Booking confirmed successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Check in a booking.
     */
    public function checkIn(
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('checkIn', $booking);

        $booking = $bookingService->checkIn($booking);

        return response()->json([
            'message' => 'Booking checked in successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Complete a booking.
     */
    public function complete(
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('complete', $booking);

        $booking = $bookingService->complete($booking);

        return response()->json([
            'message' => 'Booking completed successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Cancel a booking.
     */
    public function cancel(
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService,
        PaymentService $paymentService
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('cancel', $booking);

        $booking = $bookingService->cancel(
            $booking,
            $paymentService
        );

        return response()->json([
            'message' => 'Booking cancelled successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }
}
