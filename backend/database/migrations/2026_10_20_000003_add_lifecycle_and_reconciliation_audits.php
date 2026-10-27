<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->timestamp('refunded_at')->nullable();
            $table->foreignId('refunded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('refund_reference', 255)->nullable();
        });

        Schema::create('booking_lifecycle_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 40);
            $table->json('details')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['booking_id', 'occurred_at']);
        });

        Schema::create('cash_payment_reconciliation_cases', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('staff_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('amount', 10, 2)->nullable();
            $table->uuid('idempotency_key')->unique();
            $table->text('reason');
            $table->string('status', 20)->default('open');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();
            $table->index(['workspace_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_payment_reconciliation_cases');
        Schema::dropIfExists('booking_lifecycle_events');
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('refunded_by');
            $table->dropColumn(['refunded_at', 'refund_reference']);
        });
    }
};
