<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingResource;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Requests\UpdateBookingRequest;
use App\Models\Booking;
use App\Models\Workspace;
use App\Models\User;
use App\Services\BookingService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use App\BookingStatus;


class BookingController extends Controller
{
    public function customers(Request $request, Workspace $workspace): JsonResponse
    {
        Gate::authorize('viewCustomers', $workspace);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $workspaceId = $workspace->id;
        $customers = User::query()
            ->select(['id', 'name', 'email', 'created_at'])
            ->where(function ($query) use ($workspaceId) {
                $query->whereHas('bookings', fn ($bookings) => $bookings->where('workspace_id', $workspaceId))
                    ->orWhereHas('workspaceMembers', fn ($members) => $members
                        ->where('workspace_id', $workspaceId)
                        ->where('role', \App\WorkspaceMemberRole::CUSTOMER));
            })
            ->whereDoesntHave('workspaceMembers', fn ($query) => $query
                ->where('workspace_id', $workspaceId)
                ->whereIn('role', [\App\WorkspaceMemberRole::OWNER, \App\WorkspaceMemberRole::STAFF]))
            ->withCount(['bookings as workspace_bookings_count' => fn ($query) => $query->where('workspace_id', $workspaceId)])
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($filters['per_page'] ?? 12);

        return response()->json([
            'customers' => $customers->items(),
            'pagination' => [
                'current_page' => $customers->currentPage(),
                'per_page' => $customers->perPage(),
                'total' => $customers->total(),
                'last_page' => $customers->lastPage(),
            ],
        ]);
    }

    public function showCustomer(Request $request, Workspace $workspace, User $customer): JsonResponse
    {
        Gate::authorize('viewCustomers', $workspace);
        $isWorkspaceCustomer = $customer->bookings()->where('workspace_id', $workspace->id)->exists()
            || $workspace->members()
                ->where('user_id', $customer->id)
                ->where('role', \App\WorkspaceMemberRole::CUSTOMER)
                ->exists();
        $isWorkspaceManager = $workspace->members()
            ->where('user_id', $customer->id)
            ->whereIn('role', [\App\WorkspaceMemberRole::OWNER, \App\WorkspaceMemberRole::STAFF])
            ->exists();
        abort_unless($isWorkspaceCustomer && !$isWorkspaceManager, 404);

        $filters = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $bookings = Booking::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $customer->id)
            ->with(['user', 'resource', 'workspace', 'payment', 'payments'])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 10);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'created_at' => $customer->created_at,
                'bookings_count' => $bookings->total(),
            ],
            'bookings' => BookingResource::collection($bookings->items()),
            'pagination' => [
                'current_page' => $bookings->currentPage(),
                'per_page' => $bookings->perPage(),
                'total' => $bookings->total(),
                'last_page' => $bookings->lastPage(),
            ],
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
            ->with(['user', 'resource', 'workspace', 'payment', 'payments'])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get();

        return response()->json([
            'notifications' => BookingResource::collection($bookings),
            'unread_count' => $bookings->count(),
        ]);
    }

    /** Display bookings made by the authenticated customer. */
    public function mine(Request $request): JsonResponse
    {
        $query = Booking::query()->where('user_id', $request->user()->id);

        if ($this->hasBookingListFilters($request)) {
            return $this->bookingListResponse($request, $query);
        }

        $bookings = $query->with(['user', 'resource', 'workspace', 'payment', 'payments'])->orderByDesc('created_at')->orderByDesc('id')->get();

        return response()->json([
            'bookings' => BookingResource::collection($bookings),
        ]);
    }

    /**
     * Display all bookings for a workspace.
     */
    public function index(
        Request $request,
        Workspace $workspace
    ): JsonResponse {
        Gate::authorize('viewAny', $workspace);

        $query = Booking::query()->where('workspace_id', $workspace->id);
        if ($this->hasBookingListFilters($request)) {
            return $this->bookingListResponse($request, $query);
        }

        $bookings = $query->with(['user', 'resource', 'workspace', 'payment', 'payments'])->orderByDesc('created_at')->orderByDesc('id')->get();

        return response()->json([
            'bookings' => BookingResource::collection($bookings),
        ]);
    }

    private function hasBookingListFilters(Request $request): bool
    {
        return $request->hasAny(['tab', 'status', 'payment_status', 'payment_method', 'from', 'to', 'search', 'resource_id', 'page', 'per_page']);
    }

    private function bookingListResponse(Request $request, Builder $query): JsonResponse
    {
        $filters = $request->validate([
            'tab' => ['sometimes', 'nullable', Rule::in(['upcoming', 'history', 'all'])],
            'status' => ['sometimes', 'nullable', Rule::enum(BookingStatus::class)],
            'payment_status' => ['sometimes', 'nullable', Rule::in(['unpaid', 'pending', 'paid', 'failed', 'refunded'])],
            'payment_method' => ['sometimes', 'nullable', Rule::in(['bank_transfer', 'cash'])],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', function (string $attribute, mixed $value, \Closure $fail) use ($request): void {
                if ($request->filled('from') && $value < $request->input('from')) {
                    $fail('The end date must be on or after the start date.');
                }
            }],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'resource_id' => ['sometimes', 'nullable', 'integer', 'min:1', 'exists:resources,id'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $dailyCounts = [];
        if (($filters['tab'] ?? null) === 'all' && (isset($filters['from']) || isset($filters['to']))) {
            $countsQuery = clone $query;
            $counts = $countsQuery
                ->when($filters['from'] ?? null, fn (Builder $bookings, string $from) => $bookings->where('start_at', '>=', $from.' 00:00:00'))
                ->when($filters['to'] ?? null, fn (Builder $bookings, string $to) => $bookings->where('start_at', '<', \Carbon\Carbon::parse($to)->addDay()->startOfDay()))
                ->selectRaw('status, COUNT(*) as aggregate')
                ->groupBy('status')
                ->pluck('aggregate', 'status');
            foreach (BookingStatus::cases() as $status) {
                $dailyCounts[$status->value] = (int) $counts->get($status->value, 0);
            }
        }

        if (($filters['tab'] ?? null) === 'upcoming') {
            $query->whereIn('status', [BookingStatus::PENDING, BookingStatus::CONFIRMED, BookingStatus::CHECKED_IN]);
        } elseif (($filters['tab'] ?? null) === 'history') {
            $query->whereIn('status', [BookingStatus::CHECKED_OUT, BookingStatus::COMPLETED, BookingStatus::CANCELLED, BookingStatus::REJECTED, BookingStatus::NO_SHOW]);
        }

        $query->when($filters['status'] ?? null, fn (Builder $bookings, string $status) => $bookings->where('status', $status))
            ->when($filters['payment_status'] ?? null, function (Builder $bookings, string $paymentStatus): void {
                if ($paymentStatus === 'unpaid') {
                    $bookings->whereDoesntHave('payment');
                } else {
                    $bookings->whereHas('payment', fn (Builder $payments) => $payments->where('status', $paymentStatus));
                }
            })
            ->when($filters['payment_method'] ?? null, fn (Builder $bookings, string $paymentMethod) => $bookings->where('payment_method', $paymentMethod))
            ->when($filters['from'] ?? null, fn (Builder $bookings, string $from) => $bookings->where('start_at', '>=', $from.' 00:00:00'))
            ->when($filters['to'] ?? null, fn (Builder $bookings, string $to) => $bookings->where('start_at', '<', \Carbon\Carbon::parse($to)->addDay()->startOfDay()))
            ->when($filters['resource_id'] ?? null, fn (Builder $bookings, int $resourceId) => $bookings->where('resource_id', $resourceId))
            ->when(trim($filters['search'] ?? '') !== '', function (Builder $bookings) use ($filters): void {
                $search = trim($filters['search']);
                $bookings->where(function (Builder $matches) use ($search): void {
                    $reference = ltrim($search, '#');
                    if (ctype_digit($reference)) {
                        $matches->where('id', (int) $reference);
                    }
                    $matches->orWhereHas('resource', fn (Builder $resources) => $resources->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('workspace', fn (Builder $workspaces) => $workspaces->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('user', fn (Builder $users) => $users->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
                });
            });

        $bookings = $query->with(['user', 'resource', 'workspace', 'payment', 'payments'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return response()->json([
            'bookings' => BookingResource::collection($bookings->items()),
            'pagination' => [
                'current_page' => $bookings->currentPage(),
                'per_page' => $bookings->perPage(),
                'total' => $bookings->total(),
                'last_page' => $bookings->lastPage(),
            ],
            'counts' => $dailyCounts,
        ]);
    }

    /**
     * Create a new booking.
     */
    public function store(
        StoreBookingRequest $request,
        Workspace $workspace,
        BookingService $bookingService,
        NotificationService $notificationService,
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
        $notificationService->bookingCreated($booking, $request->user()->id);
        $booking->load(['payment', 'payments']);

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

        $booking->load(['user', 'resource', 'workspace', 'payment', 'payments']);

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

        $previousValues = [
            'resource_id' => $booking->resource_id,
            'start_at' => $booking->start_at->toISOString(),
            'end_at' => $booking->end_at->toISOString(),
        ];

        $booking = $bookingService->update(
            $request->user(),
            $booking,
            $request->validated()
        );
        if ($previousValues !== [
            'resource_id' => $booking->resource_id,
            'start_at' => $booking->start_at->toISOString(),
            'end_at' => $booking->end_at->toISOString(),
        ]) {
            app(NotificationService::class)->bookingUpdated($booking, $request->user()->id);
        }
        $booking->load(['payment', 'payments']);

        return response()->json([
            'message' => 'Booking updated successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Confirm a booking.
     */
    public function confirm(
        Request $request,
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService,
        NotificationService $notificationService,
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('confirm', $booking);

        $booking = $bookingService->confirm($booking, (int) $request->user()->id);
        $notificationService->bookingConfirmed($booking);

        return response()->json([
            'message' => 'Booking confirmed successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    public function reject(
        Request $request,
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService,
        NotificationService $notificationService,
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('reject', $booking);

        $previousPaymentStatuses = $booking->payments()->pluck('status', 'id');
        $booking = $bookingService->reject($booking, (int) $request->user()->id);
        $notificationService->bookingRejected($booking);
        foreach ($booking->payments()->get() as $payment) {
            if ($previousPaymentStatuses->get($payment->id) !== $payment->status->value) {
                $notificationService->paymentStatusChanged($payment, $payment->status->value);
            }
        }

        return response()->json([
            'message' => 'Booking rejected successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /**
     * Check in a booking.
     */
    public function checkIn(
        Request $request,
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService,
        NotificationService $notificationService,
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('checkIn', $booking);

        $booking = $bookingService->checkIn($booking, (int) $request->user()->id);
        $notificationService->bookingCheckedIn($booking);

        return response()->json([
            'message' => 'Booking checked in successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }

    /** Check out a booking from its workspace. */
    public function checkOut(
        Request $request,
        Workspace $workspace,
        Booking $booking,
        BookingService $bookingService,
        NotificationService $notificationService,
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('checkOut', $booking);

        $booking = $bookingService->checkOut($booking, (int) $request->user()->id);
        $notificationService->bookingCompleted($booking);

        return response()->json([
            'message' => 'Booking checked out successfully.',
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
        NotificationService $notificationService,
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('cancel', $booking);

        $previousPaymentStatuses = $booking->payments()->pluck('status', 'id');

        $booking = $bookingService->cancel(
            $booking,
            (int) request()->user()->id,
        );
        $notificationService->bookingCancelled($booking, request()->user()->id);
        $booking->load(['payment', 'payments']);
        foreach ($booking->payments as $payment) {
            if ($previousPaymentStatuses->get($payment->id) !== $payment->status->value) {
                $notificationService->paymentStatusChanged($payment, $payment->status->value);
            }
        }

        return response()->json([
            'message' => 'Booking cancelled successfully.',
            'booking' => new BookingResource($booking),
        ]);
    }
}
