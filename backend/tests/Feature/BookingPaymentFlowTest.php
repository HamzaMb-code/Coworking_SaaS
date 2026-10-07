<?php

namespace Tests\Feature;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\PaymentStatus;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\WorkspaceMemberRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class BookingPaymentFlowTest extends TestCase
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
        Mail::fake();

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

    public function test_workspace_staff_must_select_a_customer_and_booking_is_created_for_that_customer(): void
    {
        $this->actingAs($this->staff)
            ->postJson($this->bookingUrl(), $this->bookingData())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('customer_id');

        $response = $this->actingAs($this->staff)->postJson($this->bookingUrl(), [
            ...$this->bookingData(),
            'customer_id' => $this->customer->id,
        ])->assertCreated();

        $response->assertJsonPath('booking.user.id', $this->customer->id);
        $this->assertDatabaseHas('bookings', [
            'workspace_id' => $this->workspace->id,
            'user_id' => $this->customer->id,
            'total_price' => '200.00',
        ]);
        $this->assertDatabaseMissing('bookings', ['user_id' => $this->staff->id]);
    }

    public function test_customer_cannot_create_a_booking_for_another_user(): void
    {
        $this->actingAs($this->customer)
            ->postJson($this->bookingUrl(), [...$this->bookingData(), 'customer_id' => $this->owner->id])
            ->assertForbidden();
    }

    public function test_booking_quote_uses_server_pricing_and_rejects_overlapping_periods(): void
    {
        $data = $this->bookingData();
        $this->actingAs($this->customer)
            ->postJson("/api/workspaces/{$this->workspace->id}/bookings/quote", $data)
            ->assertOk()
            ->assertJsonPath('total_price', 200);

        $this->actingAs($this->customer)->postJson($this->bookingUrl(), $data)->assertCreated();
        $otherCustomer = User::factory()->create();
        $this->actingAs($otherCustomer)->postJson($this->bookingUrl(), $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('start_at');
    }

    public function test_staff_can_record_cash_for_a_confirmed_booking_but_cannot_refund(): void
    {
        $booking = $this->confirmedBooking();
        $response = $this->actingAs($this->staff)->postJson($this->paymentUrl($booking), [
            'payment_method' => 'cash',
        ])->assertCreated();

        $response->assertJsonPath('payment.status', 'paid')
            ->assertJsonPath('payment.amount', '123.45')
            ->assertJsonPath('payment.payment_method', 'cash');

        $payment = Payment::firstOrFail();
        $this->actingAs($this->staff)
            ->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/refund")
            ->assertForbidden();
    }

    public function test_customer_card_payment_is_pending_duplicate_creation_reuses_record_and_cancelled_booking_is_rejected(): void
    {
        $booking = $this->confirmedBooking();
        $first = $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), ['payment_method' => 'card'])
            ->assertCreated()
            ->assertJsonPath('payment.status', 'pending');
        $paymentId = $first->json('payment.id');

        $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), ['payment_method' => 'card'])
            ->assertCreated()
            ->assertJsonPath('payment.id', $paymentId);
        $this->assertDatabaseCount('payments', 1);

        $booking->update(['status' => BookingStatus::CANCELLED]);
        $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), ['payment_method' => 'card'])
            ->assertUnprocessable();
    }

    public function test_online_payment_cannot_be_manually_marked_paid_but_signed_provider_webhook_can_verify_it(): void
    {
        $booking = $this->confirmedBooking();
        $payment = $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), ['payment_method' => 'card'])->json('payment');

        $this->actingAs($this->owner)
            ->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment['id']}/paid")
            ->assertUnprocessable();

        config(['services.payments.webhook_secret' => 'test-webhook-secret']);
        $payload = ['payment_id' => $payment['id'], 'status' => 'paid', 'transaction_reference' => 'provider-ref-1'];
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $signature = hash_hmac('sha256', $body, 'test-webhook-secret');

        $this->call('POST', '/api/payments/provider/webhook', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_PAYMENT_SIGNATURE' => $signature,
        ], $body)->assertOk()->assertJsonPath('payment.status', 'paid');

        $this->assertDatabaseHas('payments', ['id' => $payment['id'], 'status' => PaymentStatus::PAID->value]);
    }

    public function test_booking_response_exposes_payment_status(): void
    {
        $booking = $this->confirmedBooking();
        Payment::create([
            'booking_id' => $booking->id,
            'amount' => $booking->total_price,
            'status' => PaymentStatus::PENDING,
            'payment_method' => 'card',
        ]);

        $this->actingAs($this->customer)->getJson('/api/my-bookings')
            ->assertOk()
            ->assertJsonPath('bookings.0.payment_status', 'pending')
            ->assertJsonPath('bookings.0.payment.amount', '123.45');
    }

    private function confirmedBooking(): Booking
    {
        return Booking::create([
            'user_id' => $this->customer->id,
            'workspace_id' => $this->workspace->id,
            'resource_id' => $this->resource->id,
            'start_at' => now()->addDays(2)->setTime(10, 0),
            'end_at' => now()->addDays(2)->setTime(11, 0),
            'status' => BookingStatus::CONFIRMED,
            'total_price' => '123.45',
        ]);
    }

    private function bookingUrl(): string
    {
        return "/api/workspaces/{$this->workspace->id}/bookings";
    }

    private function paymentUrl(Booking $booking): string
    {
        return "/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/payment";
    }

    /** @return array{resource_id: int, start_at: string, end_at: string} */
    private function bookingData(): array
    {
        $start = now()->addDays(10)->setTime(10, 0);
        $end = $start->copy()->addHours(2);

        return [
            'resource_id' => $this->resource->id,
            'start_at' => $start->toDateTimeString(),
            'end_at' => $end->toDateTimeString(),
        ];
    }
}
