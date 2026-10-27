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
use App\PaymentStatus;
use App\WorkspaceMemberRole;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationSystemTest extends TestCase
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
        $this->resource = Resource::factory()->create([
            'workspace_id' => $this->workspace->id,
            'price' => 100,
            'pricing_unit' => PricingUnit::HOUR,
            'type' => ResourceType::MEETING_ROOM,
            'status' => ResourceStatus::ACTIVE,
        ]);
    }

    public function test_customer_booking_request_notifies_only_workspace_managers(): void
    {
        $start = now()->addDay()->startOfHour();
        $response = $this->actingAs($this->customer)->postJson(
            "/api/workspaces/{$this->workspace->id}/bookings",
            [
                'resource_id' => $this->resource->id,
                'start_at' => $start->toISOString(),
                'end_at' => $start->copy()->addHour()->toISOString(),
                'payment_method' => 'bank_transfer',
            ],
        );

        $response->assertCreated()->assertJsonPath('booking.status', 'pending');
        $this->assertDatabaseCount('notifications', 2);
        $this->assertSame(1, $this->owner->unreadNotifications()->count());
        $this->assertSame(1, $this->staff->unreadNotifications()->count());
        $this->assertSame(0, $this->customer->unreadNotifications()->count());
        $this->assertSame(0, User::factory()->create()->unreadNotifications()->count());
    }

    public function test_notification_endpoints_are_user_scoped_and_support_individual_and_bulk_read(): void
    {
        $start = now()->addDay()->startOfHour();
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'workspace_id' => $this->workspace->id,
            'resource_id' => $this->resource->id,
            'start_at' => $start,
            'end_at' => $start->copy()->addHour(),
            'status' => BookingStatus::PENDING,
            'total_price' => '100.00',
        ]);

        Payment::create(['booking_id' => $booking->id, 'amount' => '100.00', 'status' => PaymentStatus::PAID, 'payment_method' => 'cash']);
        $this->actingAs($this->owner)
            ->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/confirm")
            ->assertOk();
        $notification = $this->customer->unreadNotifications()->firstOrFail();

        $this->actingAs($this->owner)
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertNotFound();

        $this->actingAs($this->customer)
            ->getJson('/api/notifications?filter=unread')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('notifications.0.title', 'Booking confirmed');

        $this->actingAs($this->customer)
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->travelTo($start->copy()->subMinutes(15));
        $this->actingAs($this->staff)
            ->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/check-in")
            ->assertOk();

        $this->actingAs($this->customer)
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->actingAs($this->customer)
            ->postJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('marked_count', 1)
            ->assertJsonPath('unread_count', 0);
    }

    public function test_customer_is_notified_when_workspace_records_a_successful_payment(): void
    {
        $start = now()->addDay()->startOfHour();
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'workspace_id' => $this->workspace->id,
            'resource_id' => $this->resource->id,
            'start_at' => $start,
            'end_at' => $start->copy()->addHour(),
            'status' => BookingStatus::CONFIRMED,
            'total_price' => '100.00',
        ]);
        $this->actingAs($this->owner)
            ->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
                'amount' => '100.00',
                'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
                'cash_received_confirmed' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('payment.status', 'paid');

        $this->assertSame(2, $this->customer->unreadNotifications()->count());
        $this->assertSame(['payment.booking_fully_paid', 'payment.paid'], $this->customer->unreadNotifications()->orderBy('created_at')->get()->pluck('data.event')->sort()->values()->all());
        $this->actingAs($this->owner)
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 0);
    }
}
