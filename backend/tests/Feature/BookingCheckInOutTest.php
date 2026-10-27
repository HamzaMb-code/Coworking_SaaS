<?php

namespace Tests\Feature;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\WorkspaceMemberRole;
use App\PaymentStatus;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingCheckInOutTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $staff;
    private User $customer;
    private Workspace $workspace;
    private Resource $resource;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->staff = User::factory()->create();
        $this->customer = User::factory()->create();
        $this->workspace = Workspace::factory()->create();
        WorkspaceMember::create(['workspace_id' => $this->workspace->id, 'user_id' => $this->owner->id, 'role' => WorkspaceMemberRole::OWNER]);
        WorkspaceMember::create(['workspace_id' => $this->workspace->id, 'user_id' => $this->staff->id, 'role' => WorkspaceMemberRole::STAFF]);
        $this->resource = $this->makeResource($this->workspace);
    }

    public function test_staff_can_check_in_and_check_out_completes_booking_with_recorded_timestamps(): void
    {
        $start = Carbon::parse('2026-10-07 10:00:00');
        $this->travelTo($start->copy()->addMinutes(5));
        $booking = $this->makeBooking(BookingStatus::CONFIRMED, $start);

        $this->actingAs($this->staff)
            ->postJson($this->actionUrl($booking, 'check-in'))
            ->assertOk()
            ->assertJsonPath('booking.status', 'checked_in')
            ->assertJsonPath('booking.checked_in_at', $start->copy()->addMinutes(5)->toISOString());

        $this->travel(2)->minutes();
        $this->actingAs($this->staff)
            ->postJson($this->actionUrl($booking, 'check-out'))
            ->assertOk()
            ->assertJsonPath('booking.status', 'completed')
            ->assertJsonPath('booking.checked_out_at', now()->toISOString());

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'completed',
            'checked_in_at' => $start->copy()->addMinutes(5)->toDateTimeString(),
            'checked_out_at' => now()->toDateTimeString(),
        ]);
        $this->assertSame(PaymentStatus::PAID, Payment::where('booking_id', $booking->id)->firstOrFail()->status);
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking->id, 'event' => 'checked_in', 'actor_id' => $this->staff->id]);
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking->id, 'event' => 'completed', 'actor_id' => $this->staff->id]);
    }

    public function test_check_in_is_blocked_until_the_full_booking_amount_is_verified(): void
    {
        $start = Carbon::parse('2026-10-07 10:00:00');
        $this->travelTo($start->copy()->addMinutes(5));
        $booking = $this->makeBooking(BookingStatus::CONFIRMED, $start, null, null, false);
        $this->actingAs($this->staff)->postJson($this->actionUrl($booking, 'check-in'))
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        Payment::create(['booking_id' => $booking->id, 'amount' => '199.00', 'status' => PaymentStatus::PAID, 'payment_method' => 'cash']);
        $this->actingAs($this->staff)->postJson($this->actionUrl($booking, 'check-in'))
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        Payment::create(['booking_id' => $booking->id, 'amount' => '1.00', 'status' => PaymentStatus::PAID, 'payment_method' => 'cash']);
        $this->actingAs($this->staff)->postJson($this->actionUrl($booking, 'check-in'))
            ->assertOk()->assertJsonPath('booking.status', 'checked_in');
    }

    public function test_check_in_allows_a_fifteen_minute_early_arrival_but_rejects_outside_times(): void
    {
        $start = Carbon::parse('2026-10-07 10:00:00');
        $this->travelTo($start->copy()->subMinutes(15));
        $booking = $this->makeBooking(BookingStatus::CONFIRMED, $start);

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings")
            ->assertOk()
            ->assertJsonPath('bookings.0.can_check_in', true);

        $this->actingAs($this->owner)
            ->postJson($this->actionUrl($booking, 'check-in'))
            ->assertOk()
            ->assertJsonPath('booking.status', 'checked_in');

        $booking = $this->makeBooking(BookingStatus::CONFIRMED, $start->copy()->addHours(3));
        $this->travelTo($start->copy()->addHours(3)->subMinutes(16));
        $this->actingAs($this->staff)
            ->postJson($this->actionUrl($booking, 'check-in'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->travelTo($start->copy()->addHours(5));
        $this->actingAs($this->staff)
            ->postJson($this->actionUrl($booking, 'check-in'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_reaching_scheduled_start_does_not_automatically_check_in(): void
    {
        $start = Carbon::parse('2026-10-07 10:00:00');
        $this->travelTo($start);
        $booking = $this->makeBooking(BookingStatus::CONFIRMED, $start);

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings")
            ->assertOk()
            ->assertJsonPath('bookings.0.status', 'confirmed')
            ->assertJsonPath('bookings.0.can_check_in', true)
            ->assertJsonPath('bookings.0.checked_in_at', null);

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => BookingStatus::CONFIRMED->value,
            'checked_in_at' => null,
        ]);
    }

    public function test_staff_can_reject_only_pending_bookings(): void
    {
        $booking = $this->makeBooking(BookingStatus::PENDING, now()->addHour());
        $pendingTransfer = Payment::create([
            'booking_id' => $booking->id, 'amount' => '200.00', 'status' => PaymentStatus::PENDING,
            'payment_method' => 'bank_transfer', 'payment_date' => now()->toDateString(), 'submitted_at' => now(),
        ]);

        $this->actingAs($this->staff)
            ->postJson($this->actionUrl($booking, 'reject'))
            ->assertOk()
            ->assertJsonPath('booking.status', 'rejected');
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking->id, 'event' => 'rejected', 'actor_id' => $this->staff->id]);
        $this->assertDatabaseHas('payments', [
            'id' => $pendingTransfer->id, 'status' => PaymentStatus::FAILED->value,
            'verified_by' => $this->staff->id, 'rejection_reason' => 'Booking rejected before the declaration was approved.',
        ]);

        $confirmed = $this->makeBooking(BookingStatus::CONFIRMED, now()->addHours(3));
        $this->actingAs($this->owner)
            ->postJson($this->actionUrl($confirmed, 'reject'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_owner_and_staff_can_list_workspace_customers_with_search_and_booking_counts(): void
    {
        $this->customer->update(['name' => 'Workspace Customer']);
        $this->makeBooking(BookingStatus::COMPLETED, now()->subDay());
        $otherWorkspace = Workspace::factory()->create();
        WorkspaceMember::create(['workspace_id' => $otherWorkspace->id, 'user_id' => $this->owner->id, 'role' => WorkspaceMemberRole::OWNER]);
        $otherCustomer = User::factory()->create(['name' => 'Outside Customer']);
        $otherResource = $this->makeResource($otherWorkspace);
        Booking::create([
            'user_id' => $otherCustomer->id,
            'workspace_id' => $otherWorkspace->id,
            'resource_id' => $otherResource->id,
            'start_at' => now()->addDay(),
            'end_at' => now()->addDays(1)->addHours(2),
            'status' => BookingStatus::CONFIRMED,
            'total_price' => '200.00',
        ]);

        foreach ([$this->owner, $this->staff] as $manager) {
            $this->actingAs($manager)
                ->getJson("/api/workspaces/{$this->workspace->id}/customers?search=Workspace")
                ->assertOk()
                ->assertJsonPath('pagination.total', 1)
                ->assertJsonPath('customers.0.id', $this->customer->id)
                ->assertJsonPath('customers.0.workspace_bookings_count', 1)
                ->assertJsonMissing(['id' => $otherCustomer->id]);
        }
    }

    public function test_customer_details_only_include_booking_history_from_the_requested_workspace(): void
    {
        $booking = $this->makeBooking(BookingStatus::COMPLETED, now()->subDay());
        $otherWorkspace = Workspace::factory()->create();
        $otherResource = $this->makeResource($otherWorkspace);
        Booking::create([
            'user_id' => $this->customer->id,
            'workspace_id' => $otherWorkspace->id,
            'resource_id' => $otherResource->id,
            'start_at' => now()->addDay(),
            'end_at' => now()->addDays(1)->addHours(2),
            'status' => BookingStatus::CONFIRMED,
            'total_price' => '200.00',
        ]);

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/customers/{$this->customer->id}")
            ->assertOk()
            ->assertJsonPath('customer.bookings_count', 1)
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('bookings.0.id', $booking->id);

        $unrelatedCustomer = User::factory()->create();
        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/customers/{$unrelatedCustomer->id}")
            ->assertNotFound();
    }

    public function test_workspace_customer_members_can_be_listed_before_their_first_booking(): void
    {
        $newCustomer = User::factory()->create(['name' => 'New Workspace Customer']);
        WorkspaceMember::create([
            'workspace_id' => $this->workspace->id,
            'user_id' => $newCustomer->id,
            'role' => WorkspaceMemberRole::CUSTOMER,
        ]);

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/customers?search=New%20Workspace")
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('customers.0.id', $newCustomer->id)
            ->assertJsonPath('customers.0.workspace_bookings_count', 0);

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/customers/{$newCustomer->id}")
            ->assertOk()
            ->assertJsonPath('customer.bookings_count', 0)
            ->assertJsonPath('pagination.total', 0);
    }

    public function test_non_workspace_members_cannot_list_customers(): void
    {
        $outsider = User::factory()->create();

        $this->actingAs($outsider)
            ->getJson("/api/workspaces/{$this->workspace->id}/customers")
            ->assertForbidden();
    }

    public function test_check_in_rejects_every_state_other_than_confirmed(): void
    {
        $this->travelTo(Carbon::parse('2026-10-07 10:00:00'));
        $booking = $this->makeBooking(BookingStatus::CONFIRMED, now()->subHour());

        foreach ([
            BookingStatus::PENDING,
            BookingStatus::CHECKED_IN,
            BookingStatus::CHECKED_OUT,
            BookingStatus::COMPLETED,
            BookingStatus::CANCELLED,
            BookingStatus::REJECTED,
            BookingStatus::NO_SHOW,
        ] as $status) {
            $booking->update(['status' => $status]);
            $this->actingAs($this->staff)
                ->postJson($this->actionUrl($booking, 'check-in'))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('status');
        }
    }

    public function test_check_out_rejects_every_state_other_than_checked_in(): void
    {
        $this->travelTo(Carbon::parse('2026-10-07 10:00:00'));
        $booking = $this->makeBooking(BookingStatus::CHECKED_IN, now()->subHour());

        foreach ([
            BookingStatus::PENDING,
            BookingStatus::CONFIRMED,
            BookingStatus::CHECKED_OUT,
            BookingStatus::COMPLETED,
            BookingStatus::CANCELLED,
            BookingStatus::REJECTED,
            BookingStatus::NO_SHOW,
        ] as $status) {
            $booking->update(['status' => $status]);
            $this->actingAs($this->staff)
                ->postJson($this->actionUrl($booking, 'check-out'))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('status');
        }
    }

    public function test_staff_from_another_workspace_and_customers_cannot_check_in_or_out(): void
    {
        $otherWorkspace = Workspace::factory()->create();
        $otherResource = $this->makeResource($otherWorkspace);
        $booking = $this->makeBooking(BookingStatus::CONFIRMED, now()->subHour(), $otherWorkspace, $otherResource);
        $booking->update(['user_id' => User::factory()->create()->id]);

        $this->actingAs($this->staff)
            ->postJson($this->actionUrl($booking, 'check-in', $otherWorkspace))
            ->assertForbidden();

        $this->actingAs($this->customer)
            ->postJson($this->actionUrl($booking, 'check-in', $otherWorkspace))
            ->assertForbidden();

        $booking->update(['status' => BookingStatus::CHECKED_IN]);
        $this->actingAs($this->customer)
            ->postJson($this->actionUrl($booking, 'check-out', $otherWorkspace))
            ->assertForbidden();
    }

    public function test_overdue_checked_in_booking_remains_checked_in_and_is_exposed_as_overdue(): void
    {
        $start = Carbon::parse('2026-10-07 10:00:00');
        $this->travelTo($start->copy()->addHours(2)->addSecond());
        $booking = $this->makeBooking(BookingStatus::CHECKED_IN, $start);
        $booking->update(['checked_in_at' => $start->copy()->addMinutes(5)]);

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings")
            ->assertOk()
            ->assertJsonPath('bookings.0.status', 'checked_in')
            ->assertJsonPath('bookings.0.is_overdue', true);

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => BookingStatus::CHECKED_IN->value,
            'checked_out_at' => null,
        ]);
    }

    public function test_scheduled_no_show_processing_marks_only_ended_confirmed_bookings(): void
    {
        $now = Carbon::parse('2026-10-07 12:00:01');
        $this->travelTo($now);
        $endedStart = $now->copy()->subHours(2);
        $confirmed = $this->makeBooking(BookingStatus::CONFIRMED, $endedStart);
        $checkedIn = $this->makeBooking(BookingStatus::CHECKED_IN, $endedStart, $this->workspace, $this->makeResource($this->workspace));
        $upcoming = $this->makeBooking(BookingStatus::CONFIRMED, $now->copy()->addHour(), $this->workspace, $this->makeResource($this->workspace));

        $this->artisan('bookings:mark-no-shows')
            ->expectsOutput('Marked 1 booking(s) as no-show.')
            ->assertSuccessful();

        $this->assertDatabaseHas('bookings', ['id' => $confirmed->id, 'status' => BookingStatus::NO_SHOW->value]);
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $confirmed->id, 'event' => 'no_show', 'actor_id' => null]);
        $this->assertSame(PaymentStatus::PAID, Payment::where('booking_id', $confirmed->id)->firstOrFail()->status);
        $this->assertDatabaseHas('bookings', ['id' => $checkedIn->id, 'status' => BookingStatus::CHECKED_IN->value]);
        $this->assertDatabaseHas('bookings', ['id' => $upcoming->id, 'status' => BookingStatus::CONFIRMED->value]);
        $this->assertSame(1, $this->customer->unreadNotifications()->count());
        $this->assertSame(1, $this->owner->unreadNotifications()->count());
        $this->assertSame(1, $this->staff->unreadNotifications()->count());

        $this->artisan('bookings:mark-no-shows')
            ->expectsOutput('Marked 0 booking(s) as no-show.')
            ->assertSuccessful();
        $this->assertDatabaseCount('notifications', 3);
    }

    public function test_customer_can_view_completed_status_and_actual_attendance_timestamps(): void
    {
        $start = Carbon::parse('2026-10-07 10:00:00');
        $booking = $this->makeBooking(BookingStatus::COMPLETED, $start);
        $checkedInAt = $start->copy()->addMinutes(7);
        $checkedOutAt = $start->copy()->addHours(1)->addMinutes(54);
        $booking->update(['checked_in_at' => $checkedInAt, 'checked_out_at' => $checkedOutAt]);

        $this->actingAs($this->customer)
            ->getJson('/api/my-bookings')
            ->assertOk()
            ->assertJsonPath('bookings.0.status', 'completed')
            ->assertJsonPath('bookings.0.checked_in_at', $checkedInAt->toISOString())
            ->assertJsonPath('bookings.0.checked_out_at', $checkedOutAt->toISOString());
    }

    public function test_customer_booking_list_separates_operational_bookings_from_history_and_paginates(): void
    {
        $this->travelTo(Carbon::parse('2026-10-11 10:00:00'));
        $upcoming = $this->makeBooking(BookingStatus::PENDING, now()->addDay());
        $this->makeBooking(BookingStatus::CONFIRMED, now()->addDays(2));
        $this->makeBooking(BookingStatus::CHECKED_IN, now()->subHour());
        $this->makeBooking(BookingStatus::COMPLETED, now()->subDays(3));
        $this->makeBooking(BookingStatus::CANCELLED, now()->subDays(4));
        $this->makeBooking(BookingStatus::REJECTED, now()->subDays(5));
        $this->makeBooking(BookingStatus::NO_SHOW, now()->subDays(6));

        $this->actingAs($this->customer)
            ->getJson('/api/my-bookings?tab=upcoming&per_page=2')
            ->assertOk()
            ->assertJsonPath('pagination.total', 3)
            ->assertJsonPath('pagination.last_page', 2);

        $this->actingAs($this->customer)
            ->getJson('/api/my-bookings?tab=upcoming&per_page=2&page=2')
            ->assertOk()
            ->assertJsonFragment(['id' => $upcoming->id, 'status' => 'pending']);

        $this->actingAs($this->customer)
            ->getJson('/api/my-bookings?tab=history&per_page=10')
            ->assertOk()
            ->assertJsonPath('pagination.total', 4)
            ->assertJsonCount(4, 'bookings');
    }

    public function test_customer_booking_list_orders_by_creation_time_across_pages_with_stable_ties_and_filters(): void
    {
        $this->travelTo(Carbon::parse('2026-10-11 10:00:00'));
        $older = $this->makeBooking(BookingStatus::PENDING, now()->addDay());
        $newer = $this->makeBooking(BookingStatus::PENDING, now()->addDays(2));
        $tieFirst = $this->makeBooking(BookingStatus::PENDING, now()->addDays(3));
        $tieSecond = $this->makeBooking(BookingStatus::PENDING, now()->addDays(4));

        $older->forceFill(['created_at' => '2026-10-01 08:00:00'])->saveQuietly();
        $newer->forceFill(['created_at' => '2026-10-02 08:00:00'])->saveQuietly();
        $tieFirst->forceFill(['created_at' => '2026-10-03 08:00:00'])->saveQuietly();
        $tieSecond->forceFill(['created_at' => '2026-10-03 08:00:00'])->saveQuietly();

        $this->actingAs($this->customer)
            ->getJson('/api/my-bookings?tab=all&status=pending&search='.$this->customer->name.'&per_page=2&page=1')
            ->assertOk()
            ->assertJsonPath('pagination.total', 4)
            ->assertJsonPath('bookings.0.id', $tieSecond->id)
            ->assertJsonPath('bookings.1.id', $tieFirst->id);

        $this->actingAs($this->customer)
            ->getJson('/api/my-bookings?tab=all&status=pending&search='.$this->customer->name.'&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('bookings.0.id', $newer->id)
            ->assertJsonPath('bookings.1.id', $older->id);
    }

    public function test_workspace_customer_booking_history_uses_creation_time_order(): void
    {
        $older = $this->makeBooking(BookingStatus::COMPLETED, now()->subDays(2));
        $newer = $this->makeBooking(BookingStatus::CANCELLED, now()->subDay());
        $older->forceFill(['created_at' => '2026-10-01 08:00:00'])->saveQuietly();
        $newer->forceFill(['created_at' => '2026-10-02 08:00:00'])->saveQuietly();

        $this->actingAs($this->owner)
            ->getJson("/api/workspaces/{$this->workspace->id}/customers/{$this->customer->id}?per_page=1")
            ->assertOk()
            ->assertJsonPath('bookings.0.id', $newer->id)
            ->assertJsonPath('pagination.total', 2);
    }

    public function test_staff_booking_list_can_filter_status_resource_search_and_dates(): void
    {
        $this->travelTo(Carbon::parse('2026-10-11 10:00:00'));
        $matching = $this->makeBooking(BookingStatus::PENDING, now()->addDays(2));
        $this->makeBooking(BookingStatus::CONFIRMED, now()->addDays(3));
        $this->makeBooking(BookingStatus::CANCELLED, now()->subDay());

        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings?tab=upcoming&status=pending&from=2026-10-13&to=2026-10-13&search={$matching->id}&resource_id={$this->resource->id}")
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('bookings.0.id', $matching->id)
            ->assertJsonPath('bookings.0.status', 'pending');
    }

    private function makeResource(Workspace $workspace): Resource
    {
        return Resource::factory()->create([
            'workspace_id' => $workspace->id,
            'price' => 100,
            'pricing_unit' => PricingUnit::HOUR,
            'type' => ResourceType::MEETING_ROOM,
            'status' => ResourceStatus::ACTIVE,
        ]);
    }

    private function makeBooking(
        BookingStatus $status,
        Carbon $start,
        ?Workspace $workspace = null,
        ?Resource $resource = null,
        bool $fullyPaid = true,
    ): Booking {
        $workspace ??= $this->workspace;
        $resource ??= $this->resource;

        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'workspace_id' => $workspace->id,
            'resource_id' => $resource->id,
            'start_at' => $start,
            'end_at' => $start->copy()->addHours(2),
            'status' => $status,
            'total_price' => '200.00',
        ]);
        if ($status === BookingStatus::CONFIRMED && $fullyPaid) {
            Payment::create(['booking_id' => $booking->id, 'amount' => '200.00', 'status' => PaymentStatus::PAID, 'payment_method' => 'cash']);
        }
        return $booking;
    }

    private function actionUrl(Booking $booking, string $action, ?Workspace $workspace = null): string
    {
        $workspace ??= $booking->workspace;
        return "/api/workspaces/{$workspace->id}/bookings/{$booking->id}/{$action}";
    }
}
