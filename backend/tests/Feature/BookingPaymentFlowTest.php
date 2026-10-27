<?php

namespace Tests\Feature;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceBankTransferDetail;
use App\Models\WorkspaceMember;
use App\PaymentStatus;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\WorkspaceMemberRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
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
        WorkspaceBankTransferDetail::create([
            'workspace_id' => $this->workspace->id,
            'beneficiary_name' => 'Test Workspace',
            'bank_name' => 'Test Bank',
            'account_identifier' => 'AB12345678',
        ]);
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

    public function test_booking_creation_requires_one_supported_payment_method_and_persists_it(): void
    {
        $this->actingAs($this->customer)->postJson($this->bookingUrl(), [...$this->bookingData(), 'payment_method' => null])
            ->assertUnprocessable()->assertJsonValidationErrors('payment_method');
        $this->actingAs($this->customer)->postJson($this->bookingUrl(), [...$this->bookingData(), 'payment_method' => 'card'])
            ->assertUnprocessable()->assertJsonValidationErrors('payment_method');

        foreach (['bank_transfer', 'cash'] as $index => $method) {
            $start = now()->addDays(20 + $index)->setTime(10, 0);
            $response = $this->actingAs($this->customer)->postJson($this->bookingUrl(), [
                ...$this->bookingData(), 'start_at' => $start->toDateTimeString(),
                'end_at' => $start->copy()->addHours(2)->toDateTimeString(), 'payment_method' => $method,
            ])->assertCreated()->assertJsonPath('booking.payment_method', $method);
            $this->assertDatabaseHas('bookings', ['id' => $response->json('booking.id'), 'payment_method' => $method]);
        }
    }

    public function test_bank_transfer_booking_is_blocked_without_workspace_details_while_cash_remains_available(): void
    {
        WorkspaceBankTransferDetail::query()->where('workspace_id', $this->workspace->id)->delete();

        $this->actingAs($this->customer)->postJson($this->bookingUrl(), [
            ...$this->bookingData(), 'payment_method' => 'bank_transfer',
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_method');

        $this->actingAs($this->customer)->postJson($this->bookingUrl(), [
            ...$this->bookingData(), 'payment_method' => 'cash',
        ])->assertCreated()->assertJsonPath('booking.payment_method', 'cash');
    }

    public function test_booking_method_cannot_be_changed_by_an_ordinary_booking_update(): void
    {
        $booking = $this->pendingBooking();
        $booking->update(['payment_method' => 'bank_transfer']);
        $this->actingAs($this->customer)->putJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}", [
            'payment_method' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_method');
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'payment_method' => 'bank_transfer']);
    }

    public function test_new_customer_booking_notifies_workspace_owner_and_staff(): void
    {
        $response = $this->actingAs($this->customer)->postJson($this->bookingUrl(), $this->bookingData())
            ->assertCreated();
        $bookingId = $response->json('booking.id');

        foreach ([$this->owner, $this->staff] as $manager) {
            $this->assertDatabaseHas('notifications', [
                'notifiable_id' => $manager->id,
                'type' => \App\Notifications\WorkspaceActivityNotification::class,
                'data->event' => 'booking.created',
                'data->booking_id' => $bookingId,
                'data->payment_method' => 'bank_transfer',
                'data->payment_method_label' => 'Bank transfer',
            ]);
        }
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'status' => BookingStatus::PENDING->value]);
    }

    public function test_workspace_booking_list_can_filter_payment_status_and_method_server_side(): void
    {
        $declared = $this->pendingBooking();
        $declared->update(['payment_method' => 'bank_transfer']);
        Payment::create([
            'booking_id' => $declared->id,
            'amount' => '123.45',
            'status' => PaymentStatus::PENDING,
            'payment_method' => 'bank_transfer',
        ]);

        $unpaidCash = $this->confirmedBooking();
        $unpaidCash->update(['payment_method' => 'cash']);

        $this->actingAs($this->owner)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings?tab=all&payment_status=pending&payment_method=bank_transfer")
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('bookings.0.id', $declared->id)
            ->assertJsonPath('bookings.0.payment.status', 'pending');

        $this->actingAs($this->owner)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings?tab=all&payment_status=unpaid&payment_method=cash")
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('bookings.0.id', $unpaidCash->id);

        $date = $declared->start_at->toDateString();
        $this->actingAs($this->staff)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings?tab=all&from={$date}&to={$date}&per_page=1")
            ->assertOk()
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonPath('counts.pending', 1)
            ->assertJsonPath('counts.confirmed', 1);
    }

    public function test_customer_cannot_start_unsupported_card_payment(): void
    {
        $booking = $this->pendingBooking();

        $this->actingAs($this->customer)
            ->postJson($this->paymentUrl($booking), ['payment_method' => 'card'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_method');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_selected_payment_method_cannot_be_switched_for_an_incompatible_payment_flow(): void
    {
        Storage::fake('local');
        $cashBooking = $this->pendingBooking();
        $cashBooking->update(['payment_method' => 'cash']);
        $this->actingAs($this->customer)->post($this->paymentUrl($cashBooking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertUnprocessable();
        $this->assertDatabaseCount('payments', 0);

        $transferBooking = $this->pendingBooking();
        $transferBooking->update(['payment_method' => 'bank_transfer']);
        $this->actingAs($this->owner)->getJson("/api/workspaces/{$this->workspace->id}/bookings/{$transferBooking->id}/cash-eligibility")
            ->assertUnprocessable()->assertJsonValidationErrors('payment_method');
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

    public function test_booking_creation_rejects_past_start_times(): void
    {
        $start = now()->subHour();
        $this->actingAs($this->customer)->postJson($this->bookingUrl(), [
            'resource_id' => $this->resource->id,
            'start_at' => $start->toDateTimeString(),
            'end_at' => $start->copy()->addHour()->toDateTimeString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('start_at');
        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_unpaid_booking_expires_after_its_payment_deadline_and_releases_the_slot(): void
    {
        $createdAt = now()->startOfSecond();
        $this->travelTo($createdAt);
        $booking = $this->actingAs($this->customer)->postJson($this->bookingUrl(), $this->bookingData())
            ->assertCreated()->assertJsonPath('booking.status', 'pending')->json('booking');
        $this->assertSame($createdAt->copy()->addMinutes(15)->toISOString(), $booking['payment_deadline_at']);

        $this->travelTo($createdAt->copy()->addMinutes(16));
        $this->artisan('bookings:expire-payment-holds')->expectsOutput('Expired 1 booking(s).')->assertSuccessful();
        $this->assertDatabaseHas('bookings', ['id' => $booking['id'], 'status' => BookingStatus::CANCELLED->value]);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $this->customer->id,
            'type' => \App\Notifications\WorkspaceActivityNotification::class,
            'data->event' => 'booking.expired',
            'data->booking_id' => $booking['id'],
        ]);
        $this->actingAs($this->customer)
            ->getJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking['id']}")
            ->assertOk()->assertJsonPath('booking.status', BookingStatus::CANCELLED->value)
            ->assertJsonPath('booking.expired', true);

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking['id']}/confirm")
            ->assertUnprocessable();
        $this->actingAs($this->customer)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking['id']}/payment", ['payment_method' => 'card'])
            ->assertUnprocessable();
        $this->actingAs(User::factory()->create())->postJson($this->bookingUrl(), $this->bookingData())->assertCreated();
    }

    public function test_payment_request_after_deadline_expires_booking_without_waiting_for_scheduler(): void
    {
        Storage::fake('local');
        $createdAt = now()->startOfSecond();
        $this->travelTo($createdAt);
        $booking = $this->actingAs($this->customer)->postJson($this->bookingUrl(), $this->bookingData())->assertCreated()->json('booking');
        $this->travelTo($createdAt->copy()->addMinutes(16));

        $this->actingAs($this->customer)->post("/api/workspaces/{$this->workspace->id}/bookings/{$booking['id']}/payment", [
            'payment_method' => 'bank_transfer', 'amount' => '200.00', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertUnprocessable();

        $this->assertDatabaseHas('bookings', ['id' => $booking['id'], 'status' => BookingStatus::CANCELLED->value]);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_pending_bank_transfer_review_pauses_expiration_until_review_finishes(): void
    {
        Storage::fake('local');
        $createdAt = now()->startOfSecond();
        $this->travelTo($createdAt);
        $booking = $this->actingAs($this->customer)->postJson($this->bookingUrl(), $this->bookingData())->assertCreated()->json('booking');
        $response = $this->actingAs($this->customer)->post("/api/workspaces/{$this->workspace->id}/bookings/{$booking['id']}/payment", [
            'payment_method' => 'bank_transfer', 'amount' => '200.00', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('payment.status', 'pending');

        $this->travelTo($createdAt->copy()->addMinutes(16));
        $this->artisan('bookings:expire-payment-holds')->expectsOutput('Expired 0 booking(s).')->assertSuccessful();
        $this->assertDatabaseHas('bookings', ['id' => $booking['id'], 'status' => BookingStatus::PENDING->value]);
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$response->json('payment.id')}/paid", ['verification_confirmed' => true])
            ->assertOk()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.booking.status', 'confirmed');
    }

    public function test_expiration_job_is_idempotent(): void
    {
        $createdAt = now()->startOfSecond();
        $this->travelTo($createdAt);
        $booking = $this->actingAs($this->customer)->postJson($this->bookingUrl(), $this->bookingData())->assertCreated()->json('booking');
        $this->travelTo($createdAt->copy()->addMinutes(16));

        $this->artisan('bookings:expire-payment-holds')->expectsOutput('Expired 1 booking(s).')->assertSuccessful();
        $updatedAt = Booking::findOrFail($booking['id'])->updated_at;
        $this->artisan('bookings:expire-payment-holds')->expectsOutput('Expired 0 booking(s).')->assertSuccessful();
        $this->assertDatabaseHas('bookings', ['id' => $booking['id'], 'status' => BookingStatus::CANCELLED->value]);
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking['id'], 'event' => 'expired', 'actor_id' => null]);
        $this->assertTrue(Booking::findOrFail($booking['id'])->updated_at->equalTo($updatedAt));
    }

    public function test_cancel_before_payment_fails_pending_declaration_with_reason_and_audit_without_deleting_proof(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $paymentData = $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->json('payment');
        $payment = Payment::findOrFail($paymentData['id']);
        $proofPath = $payment->proof_path;

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cancel")
            ->assertOk()->assertJsonPath('booking.status', BookingStatus::CANCELLED->value);

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id, 'status' => PaymentStatus::FAILED->value,
            'verified_by' => $this->owner->id, 'rejection_reason' => 'Booking cancelled before the declaration was approved.',
        ]);
        $this->assertTrue(Storage::disk('local')->exists($proofPath));
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking->id, 'event' => 'cancelled', 'actor_id' => $this->owner->id]);
        $this->assertNotNull(\App\Models\BookingLifecycleEvent::where('booking_id', $booking->id)->where('event', 'cancelled')->value('occurred_at'));
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/paid", ['verification_confirmed' => true])
            ->assertUnprocessable();
    }

    public function test_cancelling_paid_booking_preserves_payment_and_refund_requires_external_confirmation_and_audit(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();
        $receiptPath = 'payment-receipts/original.pdf';
        Storage::disk('local')->put($receiptPath, '%PDF-1.4 test receipt');
        $payment = Payment::create([
            'booking_id' => $booking->id, 'amount' => '123.45', 'status' => PaymentStatus::PAID,
            'payment_method' => 'bank_transfer', 'paid_at' => now(), 'verified_at' => now(),
            'verified_by' => $this->staff->id, 'receipt_number' => 'WSR-HISTORIC-001', 'receipt_path' => $receiptPath,
        ]);
        $refundUrl = "/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/refund";

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cancel")->assertOk();
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PAID->value, 'refunded_at' => null]);
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking->id, 'event' => 'cancelled', 'actor_id' => $this->owner->id]);
        $this->assertStringContainsString('not automatically refunded', $this->customer->notifications()->firstOrFail()->data['message']);

        $this->actingAs($this->owner)->postJson($refundUrl, [])->assertUnprocessable()->assertJsonValidationErrors(['refund_processed', 'refund_reference']);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PAID->value]);
        $this->actingAs($this->owner)->postJson($refundUrl, ['refund_processed' => true, 'refund_reference' => 'BANK-REFUND-778'])
            ->assertOk()->assertJsonPath('message', 'External refund recorded. The money movement was handled outside this application.')
            ->assertJsonPath('payment.status', PaymentStatus::REFUNDED->value)
            ->assertJsonPath('payment.refunded_by', $this->owner->id)
            ->assertJsonPath('payment.refund_reference', 'BANK-REFUND-778')
            ->assertJsonPath('payment.receipt_available', true);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'paid_at' => $payment->paid_at, 'status' => PaymentStatus::REFUNDED->value]);
        $this->assertDatabaseHas('booking_lifecycle_events', ['booking_id' => $booking->id, 'event' => 'refund_recorded', 'actor_id' => $this->owner->id]);

        $this->actingAs($this->owner)->postJson($refundUrl, ['refund_processed' => true, 'refund_reference' => 'DIFFERENT-RETRY'])
            ->assertOk()->assertJsonPath('message', 'This external refund was already recorded.')
            ->assertJsonPath('payment.refund_reference', 'BANK-REFUND-778');
        $this->actingAs($this->customer)->get("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/receipt")
            ->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs(User::factory()->create())->get("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/receipt")->assertForbidden();
    }

    public function test_payment_operation_aborts_if_booking_resource_changes_after_its_resource_snapshot(): void
    {
        $booking = $this->confirmedBooking();
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'amount' => '123.45',
            'status' => PaymentStatus::PAID,
            'payment_method' => 'cash',
        ]);
        $otherResource = Resource::factory()->create([
            'workspace_id' => $this->workspace->id,
            'price' => 100,
            'pricing_unit' => PricingUnit::HOUR,
            'type' => ResourceType::MEETING_ROOM,
            'status' => ResourceStatus::ACTIVE,
        ]);
        $changed = false;

        \Illuminate\Support\Facades\DB::listen(function (\Illuminate\Database\Events\QueryExecuted $query) use ($booking, $otherResource, &$changed): void {
            if (!$changed && preg_match('/select\\s+["`]?resource_id["`]?.*from\\s+["`]?bookings["`]?/i', $query->sql)) {
                $changed = true;
                \Illuminate\Support\Facades\DB::table('bookings')->where('id', $booking->id)->update(['resource_id' => $otherResource->id]);
            }
        });

        try {
            app(\App\Services\PaymentService::class)->refund($payment, $this->owner->id, 'external-ref-1');
            $this->fail('The payment operation should abort after detecting a stale resource snapshot.');
        } catch (\Illuminate\Validation\ValidationException $exception) {
            $this->assertArrayHasKey('booking', $exception->errors());
        }

        $this->assertTrue($changed);
        $this->assertSame($this->resource->id, Booking::findOrFail($booking->id)->resource_id);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PAID->value]);
    }

    public function test_final_or_in_progress_bookings_cannot_be_changed_through_booking_update(): void
    {
        $booking = $this->pendingBooking();
        $futureStart = now()->addDays(12)->setTime(10, 0);
        foreach ([BookingStatus::CANCELLED, BookingStatus::REJECTED, BookingStatus::CHECKED_IN, BookingStatus::CHECKED_OUT, BookingStatus::COMPLETED, BookingStatus::NO_SHOW] as $status) {
            $booking->update(['status' => $status]);
            $this->actingAs($this->customer)->putJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}", [
                'start_at' => $futureStart->toDateTimeString(), 'end_at' => $futureStart->copy()->addHour()->toDateTimeString(),
            ])->assertUnprocessable()->assertJsonValidationErrors('booking');
        }
    }

    public function test_staff_cannot_create_a_customer_payment_declaration(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();
        $declaration = [
            'payment_method' => 'bank_transfer',
            'amount' => '200.00',
            'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank',
            'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ];
        $this->actingAs($this->staff)->postJson($this->paymentUrl($booking), [
            ...$declaration,
        ])->assertForbidden();
        $this->actingAs($this->owner)->postJson($this->paymentUrl($booking), $declaration)->assertForbidden();
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_cash_is_recorded_by_workspace_staff_and_full_payment_confirms_booking_with_receipt(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $idempotencyKey = (string) \Illuminate\Support\Str::uuid();
        $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), [
            'payment_method' => 'cash', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_method');
        $this->assertDatabaseCount('payments', 0);
        $this->actingAs($this->customer)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => $idempotencyKey, 'cash_received_confirmed' => true,
        ])->assertForbidden();
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => $idempotencyKey, 'cash_received_confirmed' => true,
        ])->assertCreated()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.payment_method', 'cash')
            ->assertJsonPath('payment.verified_by', $this->owner->id)->assertJsonPath('payment.receipt_available', true)
            ->assertJsonPath('payment.booking.status', 'confirmed');
        $payment = Payment::firstOrFail();
        $this->assertNotNull($payment->verified_at);
        $this->assertNotNull($payment->paid_at);
        $this->assertSame(now()->toDateString(), $payment->payment_date->toDateString());
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::CONFIRMED->value]);
        $this->actingAs($this->customer)->get("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/receipt")
            ->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertSame(3, $this->customer->notifications()->where('type', \App\Notifications\WorkspaceActivityNotification::class)->count());
        $this->actingAs($this->staff)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => $idempotencyKey, 'cash_received_confirmed' => true,
        ])->assertOk()->assertJsonPath('message', 'This cash receipt was already recorded.')
            ->assertJsonPath('payment.verified_by', $this->owner->id);
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => $idempotencyKey, 'cash_received_confirmed' => true,
        ])->assertOk()->assertJsonPath('payment.id', $payment->id);
        $this->assertDatabaseCount('payments', 1);
        $this->assertSame(1, Payment::whereNotNull('receipt_number')->count());
    }

    public function test_cash_requires_the_full_amount_and_rejects_a_second_successful_receipt(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $url = "/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received";
        $reconciliationKey = (string) \Illuminate\Support\Str::uuid();
        $this->actingAs($this->staff)->postJson($url, ['amount' => '50.00', 'idempotency_key' => $reconciliationKey, 'cash_received_confirmed' => true])
            ->assertStatus(409)->assertJsonPath('reconciliation_required', true)->assertJsonValidationErrors('amount');
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::PENDING->value]);

        $key = $reconciliationKey;
        $this->actingAs($this->staff)->postJson($url, ['amount' => '123.45', 'idempotency_key' => $key, 'cash_received_confirmed' => true])
            ->assertCreated()->assertJsonPath('payment.booking.status', 'confirmed');
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('cash_payment_reconciliation_cases', ['idempotency_key' => $key, 'status' => 'resolved']);
        $this->assertSame(1, Payment::whereNotNull('receipt_number')->count());

        $this->actingAs($this->staff)->postJson($url, ['amount' => '123.45', 'idempotency_key' => (string) \Illuminate\Support\Str::uuid(), 'cash_received_confirmed' => true])
            ->assertStatus(409)->assertJsonPath('reconciliation_required', true);
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_cash_record_rejects_insufficient_authorization_wrong_amount_and_cancelled_or_expired_bookings(): void
    {
        $booking = $this->pendingBooking();
        $url = "/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received";
        $otherOwner = User::factory()->create();
        $key = (string) \Illuminate\Support\Str::uuid();
        $this->actingAs($otherOwner)->postJson($url, ['amount' => '123.45', 'idempotency_key' => $key, 'cash_received_confirmed' => true])->assertForbidden();
        $foreignWorkspace = Workspace::factory()->create();
        $foreignStaff = User::factory()->create();
        WorkspaceMember::create(['workspace_id' => $foreignWorkspace->id, 'user_id' => $foreignStaff->id, 'role' => WorkspaceMemberRole::STAFF]);
        $this->actingAs($foreignStaff)->postJson($url, ['amount' => '123.45', 'idempotency_key' => $key, 'cash_received_confirmed' => true])->assertForbidden();
        $this->actingAs($this->owner)->postJson($url, ['amount' => '123.46', 'idempotency_key' => $key, 'cash_received_confirmed' => true])->assertStatus(409)->assertJsonValidationErrors('amount');
        $booking->update(['status' => BookingStatus::CANCELLED]);
        $this->actingAs($this->owner)->postJson($url, ['amount' => '123.45', 'idempotency_key' => (string) \Illuminate\Support\Str::uuid(), 'cash_received_confirmed' => true])->assertStatus(409);
        $expired = $this->pendingBooking();
        $expired->update(['start_at' => now()->subMinute(), 'end_at' => now()->addHour()]);
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$expired->id}/cash-received", ['amount' => '123.45', 'idempotency_key' => (string) \Illuminate\Support\Str::uuid(), 'cash_received_confirmed' => true])->assertStatus(409);
        $deadlineExpired = $this->pendingBooking();
        $deadlineExpired->update(['payment_deadline_at' => now()->subMinute()]);
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$deadlineExpired->id}/cash-received", ['amount' => '123.45', 'idempotency_key' => (string) \Illuminate\Support\Str::uuid(), 'cash_received_confirmed' => true])->assertStatus(409);
        $this->assertDatabaseHas('bookings', ['id' => $deadlineExpired->id, 'status' => BookingStatus::CANCELLED->value]);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_cash_request_requires_explicit_receipt_confirmation_and_cannot_spoof_reviewer(): void
    {
        $booking = $this->pendingBooking();
        $url = "/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received";
        $key = (string) \Illuminate\Support\Str::uuid();
        $this->actingAs($this->owner)->postJson($url, ['amount' => '123.45', 'idempotency_key' => $key])->assertUnprocessable()->assertJsonValidationErrors('cash_received_confirmed');
        $this->actingAs($this->owner)->postJson($url, ['amount' => '123.45', 'idempotency_key' => $key, 'cash_received_confirmed' => true, 'verified_by' => $this->customer->id, 'receipt_number' => 'FAKE-RECEIPT'])->assertStatus(409)->assertJsonValidationErrors(['verified_by', 'receipt_number']);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_cash_eligibility_must_be_verified_before_accepting_money_and_rejects_unavailable_or_pending_resources(): void
    {
        $booking = $this->pendingBooking();
        $url = "/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-eligibility";
        $this->actingAs($this->customer)->getJson($url)->assertForbidden();
        $this->actingAs($this->staff)->getJson($url)->assertOk()->assertJsonPath('cash.amount_due', '123.45');

        Payment::create([
            'booking_id' => $booking->id, 'amount' => '123.45', 'status' => PaymentStatus::PENDING,
            'payment_method' => 'bank_transfer', 'submitted_at' => now(), 'payment_date' => now()->toDateString(),
        ]);
        $this->actingAs($this->staff)->getJson($url)->assertUnprocessable()->assertJsonValidationErrors('booking');
        $booking->payments()->delete();
        $this->resource->update(['status' => ResourceStatus::INACTIVE]);
        $this->actingAs($this->owner)->getJson($url)->assertUnprocessable()->assertJsonValidationErrors('resource');
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => (string) \Illuminate\Support\Str::uuid(), 'cash_received_confirmed' => true,
        ])->assertStatus(409)->assertJsonValidationErrors('resource');
    }

    public function test_cash_eligibility_rejects_a_booking_whose_resource_slot_is_not_secured(): void
    {
        $booking = $this->pendingBooking();
        Booking::create([
            'user_id' => User::factory()->create()->id,
            'workspace_id' => $this->workspace->id,
            'resource_id' => $this->resource->id,
            'start_at' => $booking->start_at,
            'end_at' => $booking->end_at,
            'status' => BookingStatus::CONFIRMED,
            'total_price' => '123.45',
        ]);
        $this->actingAs($this->staff)->getJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-eligibility")
            ->assertUnprocessable()->assertJsonValidationErrors('booking');
    }

    public function test_legacy_pending_cash_cannot_be_approved_through_the_bank_transfer_review_endpoint(): void
    {
        $booking = $this->pendingBooking();
        $payment = Payment::create([
            'booking_id' => $booking->id, 'amount' => '50.00', 'status' => PaymentStatus::PENDING,
            'payment_method' => 'cash', 'submitted_at' => now(), 'payment_date' => now()->toDateString(),
        ]);
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/paid", ['verification_confirmed' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PENDING->value]);
    }

    public function test_receipt_storage_failure_does_not_rollback_a_recorded_cash_payment_or_booking_confirmation(): void
    {
        $booking = $this->pendingBooking();
        $this->mock(\App\Services\PaymentReceiptService::class, function ($mock): void {
            $mock->shouldReceive('issue')->once()->andThrow(new \RuntimeException('disk unavailable'));
        });
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => (string) \Illuminate\Support\Str::uuid(), 'cash_received_confirmed' => true,
        ])->assertCreated()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.receipt_available', false)
            ->assertJsonPath('payment.booking.status', 'confirmed');
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::CONFIRMED->value]);
    }

    public function test_unexpected_cash_recording_failure_returns_a_reconciliation_reference(): void
    {
        $booking = $this->pendingBooking();
        Log::spy();
        $this->partialMock(\App\Services\PaymentService::class, function ($mock): void {
            $mock->shouldReceive('recordCashReceived')->once()->andThrow(new \RuntimeException('temporary database failure'));
        });
        $key = (string) \Illuminate\Support\Str::uuid();
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/cash-received", [
            'amount' => '123.45', 'idempotency_key' => $key, 'cash_received_confirmed' => true,
        ])->assertStatus(503)->assertJsonPath('reconciliation_required', true)->assertJsonPath('reconciliation_reference', $key);
        Log::shouldHaveReceived('critical')->once();
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::PENDING->value]);
        $this->assertDatabaseHas('cash_payment_reconciliation_cases', [
            'booking_id' => $booking->id, 'staff_user_id' => $this->owner->id,
            'idempotency_key' => $key, 'status' => 'open', 'amount' => '123.45',
        ]);
        $this->actingAs($this->customer)->getJson("/api/workspaces/{$this->workspace->id}/cash-reconciliations")->assertForbidden();
        $this->actingAs($this->staff)->getJson("/api/workspaces/{$this->workspace->id}/cash-reconciliations")->assertOk()->assertJsonPath('cases.data.0.status', 'open');
        $caseId = \App\Models\CashPaymentReconciliationCase::firstOrFail()->id;
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/cash-reconciliations/{$caseId}/resolve", ['resolution_notes' => 'Verified cash was recorded in the cash ledger.'])
            ->assertOk()->assertJsonPath('case.status', 'resolved')->assertJsonPath('case.resolved_by', $this->owner->id);
    }

    public function test_customer_cannot_approve_an_existing_cash_payment(): void
    {
        $booking = $this->pendingBooking();
        $payment = Payment::create([
            'booking_id' => $booking->id, 'amount' => '123.45', 'status' => PaymentStatus::PENDING,
            'payment_method' => 'cash', 'submitted_at' => now(), 'payment_date' => now()->toDateString(),
        ]);
        $this->actingAs($this->customer)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/paid", ['verification_confirmed' => true])
            ->assertForbidden();
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PENDING->value]);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::PENDING->value]);
    }

    public function test_customer_bank_transfer_is_private_pending_and_rejected_payment_does_not_count(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();
        $response = $this->actingAs($this->customer)->post("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/payment", [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'transaction_reference' => 'TX-123', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ]);
        $response->assertCreated()->assertJsonPath('payment.status', 'pending')->assertJsonPath('payment.booking.verified_amount', 0)
            ->assertJsonMissingPath('payment.proof_path');
        $payment = Payment::firstOrFail();
        $this->assertTrue(Storage::disk('local')->exists($payment->proof_path));
        $this->actingAs(User::factory()->create())->get("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/proof")->assertForbidden();
        $this->actingAs($this->owner)->get("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/proof")->assertOk();
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/failed", ['reason' => 'Reference does not match'])
            ->assertOk()->assertJsonPath('payment.status', 'failed')->assertJsonPath('payment.receipt_available', false);
        $this->assertSame(0.0, app(\App\Services\PaymentService::class)->summary($booking)['verified_amount']);
        $this->actingAs($this->staff)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/check-in")
            ->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_bank_transfer_declaration_notifies_workspace_owner_and_staff(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();

        $response = $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('payment.status', PaymentStatus::PENDING->value);
        $paymentId = $response->json('payment.id');

        foreach ([$this->owner, $this->staff] as $manager) {
            $this->assertDatabaseHas('notifications', [
                'notifiable_id' => $manager->id,
                'type' => \App\Notifications\WorkspaceActivityNotification::class,
                'data->event' => 'payment.submitted',
                'data->title' => 'New payment declaration',
                'data->booking_id' => $booking->id,
                'data->payment_id' => $paymentId,
                'data->workspace_id' => $this->workspace->id,
                'data->url' => "/workspaces/{$this->workspace->id}/payments",
            ]);
        }

        $this->actingAs($this->owner)->getJson('/api/notifications?filter=unread')
            ->assertOk()->assertJsonPath('unread_count', 1)
            ->assertJsonPath('notifications.0.type', 'payment.submitted')
            ->assertJsonPath('notifications.0.title', 'New payment declaration')
            ->assertJsonPath('notifications.0.url', "/workspaces/{$this->workspace->id}/payments");
        $this->assertSame(1, $this->customer->unreadNotifications()->where('data->event', 'payment.submitted')->count());
    }

    public function test_full_bank_transfer_approval_confirms_pending_booking_but_rejection_does_not(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $response = $this->actingAs($this->customer)->post("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/payment", [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('payment.booking.status', 'pending');
        $paymentId = $response->json('payment.id');
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$paymentId}/paid", ['verification_confirmed' => true])
            ->assertOk()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.booking.status', 'confirmed')->assertJsonPath('payment.receipt_available', true);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::CONFIRMED->value]);
        $payment = Payment::findOrFail($paymentId);
        $this->assertTrue(Storage::disk('local')->exists($payment->receipt_path));
        $this->actingAs(User::factory()->create())->get("/api/workspaces/{$this->workspace->id}/payments/{$paymentId}/receipt")->assertForbidden();
        $this->actingAs($this->customer)->get("/api/workspaces/{$this->workspace->id}/payments/{$paymentId}/receipt")->assertOk()->assertHeader('content-type', 'application/pdf');

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$paymentId}/paid", ['verification_confirmed' => true])
            ->assertOk()->assertJsonPath('message', 'This bank-transfer approval was already recorded.');
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_bank_transfer_declaration_and_edit_must_cover_the_full_remaining_balance(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();
        $url = $this->paymentUrl($booking);
        $this->actingAs($this->customer)->post($url, [
            'payment_method' => 'bank_transfer', 'amount' => '50.00', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertDatabaseCount('payments', 0);
        Storage::disk('local')->assertDirectoryEmpty('payment-proofs');

        $payment = $this->actingAs($this->customer)->post($url, [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('valid-proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->json('payment');
        $this->actingAs($this->customer)->putJson("/api/workspaces/{$this->workspace->id}/payments/{$payment['id']}", [
            'amount' => '50.00', 'payment_date' => now()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertDatabaseHas('payments', ['id' => $payment['id'], 'amount' => '123.45', 'status' => PaymentStatus::PENDING->value]);
    }

    public function test_rejected_transfer_reason_is_visible_and_customer_can_retry_without_losing_declaration(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();
        $first = $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('first-proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->json('payment');
        $firstPayment = Payment::findOrFail($first['id']);
        $firstProofPath = $firstPayment->proof_path;
        $reason = 'Transfer not received';

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$first['id']}/failed", ['reason' => $reason])
            ->assertOk()->assertJsonPath('payment.status', 'failed')->assertJsonPath('payment.rejection_reason', $reason);
        $this->actingAs($this->customer)->getJson('/api/my-payments')->assertOk()
            ->assertJsonPath('payments.data.0.rejection_reason', $reason);
        $this->assertSame(0.0, app(\App\Services\PaymentService::class)->summary($booking)['verified_amount']);
        $this->assertTrue(Storage::disk('local')->exists($firstProofPath));

        $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('retry-proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('payment.status', 'pending');
        $this->assertDatabaseCount('payments', 2);
        $this->assertDatabaseHas('payments', ['id' => $first['id'], 'status' => PaymentStatus::FAILED->value, 'rejection_reason' => $reason]);
    }

    public function test_bank_transfer_review_requires_workspace_authorization_and_preserves_pending_on_cancelled_booking(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $payment = $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->json('payment');
        $reviewUrl = "/api/workspaces/{$this->workspace->id}/payments/{$payment['id']}/paid";

        $this->actingAs($this->customer)->postJson($reviewUrl, ['verification_confirmed' => true])->assertForbidden();
        $foreignWorkspace = Workspace::factory()->create();
        $foreignStaff = User::factory()->create();
        WorkspaceMember::create(['workspace_id' => $foreignWorkspace->id, 'user_id' => $foreignStaff->id, 'role' => WorkspaceMemberRole::STAFF]);
        $this->actingAs($foreignStaff)->postJson($reviewUrl, ['verification_confirmed' => true])->assertForbidden();

        $booking->update(['status' => BookingStatus::CANCELLED]);
        $this->actingAs($this->owner)->postJson($reviewUrl, ['verification_confirmed' => true])->assertUnprocessable();
        $this->assertDatabaseHas('payments', ['id' => $payment['id'], 'status' => PaymentStatus::PENDING->value, 'receipt_path' => null]);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::CANCELLED->value]);
    }

    public function test_bank_transfer_approval_rejects_inactive_resource_without_losing_proof(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $paymentData = $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->json('payment');
        $payment = Payment::findOrFail($paymentData['id']);
        $proofPath = $payment->proof_path;
        $this->resource->update(['status' => ResourceStatus::INACTIVE]);

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/paid", ['verification_confirmed' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('resource');
        $this->assertTrue(Storage::disk('local')->exists($proofPath));
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PENDING->value]);
    }

    public function test_bank_transfer_approval_rejects_partial_legacy_declarations_and_overlapping_bookings(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $payment = Payment::create([
            'booking_id' => $booking->id, 'amount' => '50.00', 'status' => PaymentStatus::PENDING,
            'payment_method' => 'bank_transfer', 'submitted_at' => now(), 'payment_date' => now()->toDateString(),
            'proof_path' => 'payment-proofs/legacy-partial.pdf',
        ]);
        Storage::disk('local')->put($payment->proof_path, 'proof');

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/paid", ['verification_confirmed' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PENDING->value, 'verified_by' => null]);

        $payment->update(['amount' => '123.45']);
        $conflictingBooking = Booking::create([
            'user_id' => User::factory()->create()->id,
            'workspace_id' => $this->workspace->id,
            'resource_id' => $this->resource->id,
            'start_at' => $booking->start_at,
            'end_at' => $booking->end_at,
            'status' => BookingStatus::CONFIRMED,
            'total_price' => '123.45',
        ]);

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment->id}/paid", ['verification_confirmed' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('booking');
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => PaymentStatus::PENDING->value, 'verified_by' => null]);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::PENDING->value]);
        $this->assertTrue(Storage::disk('local')->exists($payment->proof_path));
        $this->assertDatabaseHas('bookings', ['id' => $conflictingBooking->id, 'status' => BookingStatus::CONFIRMED->value]);
    }

    public function test_bank_transfer_receipt_failure_does_not_undo_approved_payment_or_booking_confirmation(): void
    {
        Storage::fake('local');
        $booking = $this->pendingBooking();
        $payment = $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(),
            'bank_name' => 'Example Bank', 'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated()->json('payment');
        $this->mock(\App\Services\PaymentReceiptService::class, function ($mock): void {
            $mock->shouldReceive('issue')->once()->andThrow(new \RuntimeException('private storage unavailable'));
        });

        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment['id']}/paid", ['verification_confirmed' => true])
            ->assertOk()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.receipt_available', false)
            ->assertJsonPath('message', 'Payment approved, but receipt generation failed. Retry approval to generate the receipt.')
            ->assertJsonPath('payment.booking.status', 'confirmed');
        $this->assertDatabaseHas('payments', ['id' => $payment['id'], 'status' => PaymentStatus::PAID->value]);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::CONFIRMED->value]);
    }

    public function test_owner_cannot_confirm_pending_booking_before_full_payment_is_verified(): void
    {
        $booking = $this->pendingBooking();
        $this->actingAs($this->owner)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/confirm")
            ->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->actingAs($this->customer)->postJson("/api/workspaces/{$this->workspace->id}/bookings/{$booking->id}/confirm")
            ->assertForbidden();
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::PENDING->value]);
    }

    public function test_customer_cannot_submit_invalid_manual_amount_or_bank_proof(): void
    {
        $booking = $this->confirmedBooking();
        $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '999.00', 'payment_date' => now()->addDay()->toDateString(),
            'bank_name' => 'Bank', 'transaction_reference' => 'TX',
        ])->assertUnprocessable()->assertJsonValidationErrors(['proof', 'payment_date']);
    }

    public function test_customer_cannot_create_card_payment_records(): void
    {
        $booking = $this->confirmedBooking();
        $this->actingAs($this->customer)->postJson($this->paymentUrl($booking), ['payment_method' => 'card'])
            ->assertUnprocessable()->assertJsonValidationErrors('payment_method');
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_online_payment_cannot_be_manually_marked_paid_but_signed_provider_webhook_can_verify_it(): void
    {
        $booking = $this->confirmedBooking();
        // Preserve webhook compatibility for historical provider rows while
        // preventing customers from creating new card payments.
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'amount' => $booking->total_price,
            'status' => PaymentStatus::PENDING,
            'payment_method' => 'card',
            'submitted_at' => now(),
            'payment_date' => now()->toDateString(),
        ])->toArray();

        $this->actingAs($this->owner)
            ->postJson("/api/workspaces/{$this->workspace->id}/payments/{$payment['id']}/paid", ['verification_confirmed' => true])
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

    public function test_workspace_payment_dashboard_returns_status_counts_and_restricts_workspace_access(): void
    {
        Storage::fake('local');
        $booking = $this->confirmedBooking();
        $this->actingAs($this->customer)->post($this->paymentUrl($booking), [
            'payment_method' => 'bank_transfer', 'amount' => '123.45', 'payment_date' => now()->toDateString(), 'bank_name' => 'Example Bank',
            'proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertCreated();

        $this->actingAs($this->owner)->getJson("/api/workspaces/{$this->workspace->id}/payments?status=pending")
            ->assertOk()->assertJsonPath('counts.pending', 1)->assertJsonPath('counts.paid', 0)
            ->assertJsonPath('payments.data.0.booking.status', 'confirmed');

        $anotherWorkspace = Workspace::factory()->create();
        $this->actingAs($this->owner)->getJson("/api/workspaces/{$anotherWorkspace->id}/payments")
            ->assertForbidden();
    }

    public function test_workspace_payment_list_orders_by_creation_time_across_pages_with_stable_ties_and_filters(): void
    {
        $olderBooking = $this->confirmedBooking();
        $newerBooking = $this->confirmedBooking();
        $tieFirstBooking = $this->confirmedBooking();
        $tieSecondBooking = $this->confirmedBooking();
        $payments = collect([$olderBooking, $newerBooking, $tieFirstBooking, $tieSecondBooking])->map(fn (Booking $booking) => Payment::create([
            'booking_id' => $booking->id,
            'amount' => '123.45',
            'status' => PaymentStatus::PENDING,
            'payment_method' => 'bank_transfer',
            'submitted_at' => now(),
            'payment_date' => now()->toDateString(),
        ]));

        $payments[0]->forceFill(['created_at' => '2026-10-01 08:00:00'])->saveQuietly();
        $payments[1]->forceFill(['created_at' => '2026-10-02 08:00:00'])->saveQuietly();
        $payments[2]->forceFill(['created_at' => '2026-10-03 08:00:00'])->saveQuietly();
        $payments[3]->forceFill(['created_at' => '2026-10-03 08:00:00'])->saveQuietly();

        $this->actingAs($this->owner)
            ->getJson("/api/workspaces/{$this->workspace->id}/payments?status=pending&method=bank_transfer&search={$this->customer->name}&per_page=2&page=1")
            ->assertOk()
            ->assertJsonPath('payments.meta.total', 4)
            ->assertJsonPath('payments.data.0.id', $payments[3]->id)
            ->assertJsonPath('payments.data.1.id', $payments[2]->id);

        $this->actingAs($this->owner)
            ->getJson("/api/workspaces/{$this->workspace->id}/payments?status=pending&method=bank_transfer&search={$this->customer->name}&per_page=2&page=2")
            ->assertOk()
            ->assertJsonPath('payments.data.0.id', $payments[1]->id)
            ->assertJsonPath('payments.data.1.id', $payments[0]->id);

        $this->actingAs($this->customer)->getJson('/api/my-payments?per_page=2')
            ->assertOk()
            ->assertJsonPath('payments.data.0.id', $payments[3]->id)
            ->assertJsonPath('payments.data.1.id', $payments[2]->id);
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

    private function pendingBooking(): Booking
    {
        return Booking::create([
            'user_id' => $this->customer->id,
            'workspace_id' => $this->workspace->id,
            'resource_id' => $this->resource->id,
            'start_at' => now()->addDays(2)->setTime(10, 0),
            'end_at' => now()->addDays(2)->setTime(11, 0),
            'status' => BookingStatus::PENDING,
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
            'payment_method' => 'bank_transfer',
        ];
    }
}
