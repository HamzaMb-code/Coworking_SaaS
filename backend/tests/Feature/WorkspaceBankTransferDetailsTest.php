<?php

namespace Tests\Feature;

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\WorkspaceBankTransferDetail;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\WorkspaceMemberRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceBankTransferDetailsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $staff;
    private User $customer;
    private Workspace $workspace;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        $this->staff = User::factory()->create();
        $this->customer = User::factory()->create();
        $this->workspace = Workspace::factory()->create();
        WorkspaceMember::create(['workspace_id' => $this->workspace->id, 'user_id' => $this->owner->id, 'role' => WorkspaceMemberRole::OWNER]);
        WorkspaceMember::create(['workspace_id' => $this->workspace->id, 'user_id' => $this->staff->id, 'role' => WorkspaceMemberRole::STAFF]);
        $resource = Resource::factory()->create([
            'workspace_id' => $this->workspace->id, 'price' => 100, 'pricing_unit' => PricingUnit::HOUR,
            'type' => ResourceType::MEETING_ROOM, 'status' => ResourceStatus::ACTIVE,
        ]);
        $this->booking = Booking::query()->create([
            'user_id' => $this->customer->id, 'workspace_id' => $this->workspace->id, 'resource_id' => $resource->id,
            'start_at' => now()->addDays(2), 'end_at' => now()->addDays(2)->addHour(),
            'total_price' => '100.00', 'status' => BookingStatus::PENDING,
            'payment_deadline_at' => now()->addMinutes(15), 'payment_method' => 'bank_transfer',
        ]);
    }

    public function test_owner_can_configure_encrypted_beneficiary_details_and_customer_sees_only_own_workspace_details(): void
    {
        $payload = ['beneficiary_name' => 'Workspace SARL', 'bank_name' => 'CIH', 'account_identifier' => '007780000012345678901234'];
        $this->actingAs($this->owner)->putJson($this->url(), $payload)->assertOk()
            ->assertJsonPath('details.account_identifier', $payload['account_identifier']);
        $stored = WorkspaceBankTransferDetail::query()->firstOrFail();
        $this->assertNotSame($payload['account_identifier'], $stored->getRawOriginal('account_identifier'));

        $this->actingAs($this->customer)->getJson($this->url().'?booking_id='.$this->booking->id)->assertOk()
            ->assertJsonPath('configured', true)
            ->assertJsonPath('details.beneficiary_name', $payload['beneficiary_name'])
            ->assertJsonPath('details.bank_name', $payload['bank_name'])
            ->assertJsonPath('details.account_identifier', $payload['account_identifier']);
        $this->actingAs($this->staff)->getJson($this->url())->assertOk()->assertJsonPath('configured', true);
    }

    public function test_missing_details_and_cross_workspace_customer_requests_are_safe(): void
    {
        $this->actingAs($this->customer)->getJson($this->url().'?booking_id='.$this->booking->id)
            ->assertOk()->assertJsonPath('configured', false)->assertJsonPath('details', null);

        $otherWorkspace = Workspace::factory()->create();
        $this->actingAs($this->customer)->getJson("/api/workspaces/{$otherWorkspace->id}/bank-transfer-details?booking_id={$this->booking->id}")
            ->assertNotFound();
        $otherCustomer = User::factory()->create();
        $this->actingAs($otherCustomer)->getJson($this->url().'?booking_id='.$this->booking->id)->assertNotFound();
    }

    public function test_only_workspace_owner_can_edit_and_fields_are_validated(): void
    {
        $payload = ['beneficiary_name' => 'Workspace SARL', 'bank_name' => 'CIH', 'account_identifier' => '007780000012345678901234'];
        $this->actingAs($this->staff)->putJson($this->url(), $payload)->assertForbidden();
        $this->actingAs($this->owner)->putJson($this->url(), [...$payload, 'account_identifier' => '---'])
            ->assertUnprocessable()->assertJsonValidationErrors('account_identifier');
        $this->assertDatabaseCount('workspace_bank_transfer_details', 0);
    }

    private function url(): string
    {
        return "/api/workspaces/{$this->workspace->id}/bank-transfer-details";
    }
}
