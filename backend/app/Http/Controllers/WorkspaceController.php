<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Models\Booking;
use App\Models\WorkspaceBankTransferDetail;
use App\WorkspaceMemberRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

class WorkspaceController extends Controller
{

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'resource_type' => ['nullable', 'string', 'max:255'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'capacity' => ['nullable', 'integer', 'min:1'],
        ]);

        if (in_array($validated['resource_type'] ?? null, ['coworking', 'hot_desk'], true)) {
            $validated['resource_type'] = 'desk';
        }

        $resourceFilters = function ($resourceQuery) use ($validated) {
            $resourceQuery->where('status', 'active')
                ->when($validated['resource_type'] ?? null, fn ($query, $type) =>
                    $query->where('type', $type)
                )
                ->when($validated['capacity'] ?? null, fn ($query, $capacity) =>
                    $query->where('capacity', '>=', $capacity)
                );

            if (($validated['price'] ?? null) !== null) {
                $resourceQuery->where('price', '<=', $validated['price']);
            }

            if (! empty($validated['date'])) {
                $date = \Illuminate\Support\Carbon::createFromFormat('Y-m-d', $validated['date']);
                $dayStart = $date->copy()->startOfDay();
                $dayEnd = $date->copy()->addDay()->startOfDay();
                $resourceQuery->whereDoesntHave('bookings', function ($bookingQuery) use ($dayStart, $dayEnd) {
                    $bookingQuery->whereIn('status', [
                        \App\BookingStatus::PENDING->value,
                        \App\BookingStatus::CONFIRMED->value,
                        \App\BookingStatus::CHECKED_IN->value,
                    ])->where('start_at', '<', $dayEnd)
                        ->where('end_at', '>', $dayStart);
                });
            }

            return $resourceQuery;
        };

        $workspaces = Workspace::query()
            ->where('status', 'active')
            ->when($validated['search'] ?? null, function ($query, $search) {
                $query->where(function ($workspaceQuery) use ($search) {
                    $workspaceQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->when($validated['city'] ?? null, fn ($query, $city) =>
                $query->where('city', 'like', "%{$city}%")
            )
            ->when(
                ($validated['resource_type'] ?? null)
                    || ($validated['price'] ?? null) !== null
                    || ($validated['capacity'] ?? null) !== null
                    || ! empty($validated['date']),
                fn ($query) => $query->whereHas('resources', $resourceFilters)
            )
            ->withCount(['resources as available_resources_count' => $resourceFilters])
            ->withMin(['resources as starting_price' => $resourceFilters], 'price')
            ->with(['resources' => fn ($query) => $resourceFilters($query)
                ->orderBy('price')
                ->select(['id', 'workspace_id', 'type', 'price', 'pricing_unit'])
            ])
            ->orderBy('city')
            ->orderBy('name')
            ->get();

        return response()->json([
            'workspaces' => $workspaces,
        ]);
    }

    public function mine(Request $request): JsonResponse
    {
        $workspaces = $request->user()
            ->workspaces()
            ->with('members')
            ->get();

        return response()->json([
            'workspaces' => $workspaces,
        ]);
    }

    public function owned(Request $request): JsonResponse
    {
        $workspaces = $request->user()
            ->workspaces()
            ->wherePivot('role', WorkspaceMemberRole::OWNER->value)
            ->withCount('bookings')
            ->withCount(['resources as available_resources_count' => fn ($query) =>
                $query->where('status', 'active')
            ])
            ->orderBy('name')
            ->get();

        return response()->json([
            'workspaces' => $workspaces,
        ]);
    }

    public function show(Workspace $workspace): JsonResponse
    {
        Gate::authorize('view', $workspace);

        return response()->json([
            'workspace' => $workspace->load('members'),
        ]);
    }

    public function bankTransferDetails(Request $request, Workspace $workspace): JsonResponse
    {
        $canViewPayments = Gate::allows('viewPayments', $workspace);
        $statusOnly = $request->boolean('status_only');
        if ($statusOnly && !$canViewPayments) {
            Gate::authorize('view', $workspace);
            return response()->json([
                'configured' => WorkspaceBankTransferDetail::isConfiguredForWorkspace($workspace->id),
                'details' => null,
            ]);
        }

        if (! $canViewPayments) {
            $validated = $request->validate(['booking_id' => ['required', 'integer', 'min:1']]);
            $ownsBooking = Booking::query()->where('workspace_id', $workspace->id)
                ->where('user_id', $request->user()->id)->whereKey($validated['booking_id'])->exists();
            abort_unless($ownsBooking, 404);
        }

        $details = WorkspaceBankTransferDetail::query()->where('workspace_id', $workspace->id)->first();
        $configured = $details !== null && WorkspaceBankTransferDetail::isConfiguredForWorkspace($workspace->id);
        if ($statusOnly) {
            return response()->json(['configured' => $configured, 'details' => null]);
        }

        return response()->json([
            'configured' => $configured,
            'details' => $configured && $details ? [
                'beneficiary_name' => $details->beneficiary_name,
                'bank_name' => $details->bank_name,
                'account_identifier' => $details->account_identifier,
            ] : null,
        ]);
    }

    public function updateBankTransferDetails(Request $request, Workspace $workspace): JsonResponse
    {
        Gate::authorize('update', $workspace);
        $validated = $request->validate([
            'beneficiary_name' => ['required', 'string', 'max:150'],
            'bank_name' => ['required', 'string', 'max:120'],
            'account_identifier' => ['required', 'string', 'min:8', 'max:64', 'regex:/^[A-Za-z0-9 ]+$/'],
        ]);

        $details = WorkspaceBankTransferDetail::query()->updateOrCreate(
            ['workspace_id' => $workspace->id],
            $validated,
        );

        return response()->json([
            'message' => 'Bank-transfer beneficiary details saved.',
            'configured' => true,
            'details' => [
                'beneficiary_name' => $details->beneficiary_name,
                'bank_name' => $details->bank_name,
                'account_identifier' => $details->account_identifier,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Workspace::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:workspaces,slug'],
            'description' => ['nullable', 'string'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $image = $validated['image'] ?? null;
        unset($validated['image']);
        if ($image) {
            $validated['image_path'] = $image->store('workspaces', 'public');
        }

        try {
            $workspace = DB::transaction(function () use ($validated, $request) {
                $workspace = Workspace::create($validated);
                $workspace->members()->create([
                    'user_id' => $request->user()->id,
                    'role' => WorkspaceMemberRole::OWNER,
                ]);

                return $workspace;
            });
        } catch (\Throwable $exception) {
            if (! empty($validated['image_path'])) {
                Storage::disk('public')->delete($validated['image_path']);
            }
            throw $exception;
        }

        return response()->json([
            'message' => 'Workspace created successfully.',
            'workspace' => $workspace->load('members.user'),
        ], 201);
    }

    public function update(Request $request, Workspace $workspace): JsonResponse
    {
        Gate::authorize('update', $workspace);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => [
                'sometimes',
                'string',
                'max:255',
                'unique:workspaces,slug,' . $workspace->id,
            ],
            'description' => ['sometimes', 'nullable', 'string'],
            'address' => ['sometimes', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'status' => ['sometimes', 'string'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_image' => ['sometimes', 'boolean'],
        ]);

        $oldImagePath = $workspace->image_path;
        $newImagePath = null;
        if ($request->hasFile('image')) {
            $newImagePath = $request->file('image')->store('workspaces', 'public');
            $validated['image_path'] = $newImagePath;
        } elseif ($request->boolean('remove_image')) {
            $validated['image_path'] = null;
        }
        unset($validated['image'], $validated['remove_image']);

        try {
            $workspace->update($validated);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                Storage::disk('public')->delete($newImagePath);
            }
            throw $exception;
        }
        if ($oldImagePath && ($newImagePath || $request->boolean('remove_image'))) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return response()->json([
            'message' => 'Workspace updated successfully.',
            'workspace' => $workspace->load('members.user'),
        ]);
    }

    public function destroy(Workspace $workspace): JsonResponse
    {
        Gate::authorize('delete', $workspace);

        $imagePath = $workspace->image_path;
        $workspace->delete();
        if ($imagePath) {
            Storage::disk('public')->delete($imagePath);
        }

        return response()->json([
            'message' => 'Workspace deleted successfully.',
        ]);
    }
}
