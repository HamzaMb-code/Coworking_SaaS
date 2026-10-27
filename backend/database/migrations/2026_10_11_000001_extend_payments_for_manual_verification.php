<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The unique booking index is also the index MySQL uses to enforce
        // the booking foreign key. Replace it only after adding a normal index.
        Schema::table('payments', function (Blueprint $table) {
            $table->index('booking_id', 'payments_booking_id_index');
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique(['booking_id']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->date('payment_date')->nullable()->after('paid_at');
            $table->timestamp('submitted_at')->nullable()->after('payment_date');
            $table->string('bank_name', 120)->nullable()->after('payment_method');
            $table->string('proof_path')->nullable()->after('bank_name');
            $table->foreignId('verified_by')->nullable()->after('proof_path')->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable()->after('verified_by');
            $table->text('rejection_reason')->nullable()->after('verified_at');
            $table->string('receipt_number', 64)->nullable()->unique()->after('rejection_reason');
            $table->string('receipt_path')->nullable()->after('receipt_number');
            $table->index(['status', 'submitted_at']);
            $table->index(['payment_method', 'payment_date']);
        });

        DB::table('payments')->whereNull('submitted_at')->update(['submitted_at' => DB::raw('created_at')]);
        DB::table('payments')->whereNull('payment_date')->update(['payment_date' => DB::raw('DATE(COALESCE(paid_at, created_at) )')]);
        DB::table('payments')->where('status', 'paid')->whereNull('verified_at')->update([
            'verified_at' => DB::raw('COALESCE(paid_at, updated_at)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['status', 'submitted_at']);
            $table->dropIndex(['payment_method', 'payment_date']);
            $table->dropUnique(['receipt_number']);
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn([
                'payment_date', 'submitted_at', 'bank_name', 'proof_path', 'verified_at',
                'rejection_reason', 'receipt_number', 'receipt_path',
            ]);
        });

        // Keep the migration rollback safe after multiple submissions have been
        // recorded; restoring the old unique constraint would fail and block
        // rollback without a data-preserving merge strategy.
        $hasMultiple = DB::table('payments')->select('booking_id')->groupBy('booking_id')->havingRaw('COUNT(*) > 1')->exists();
        if (! $hasMultiple) {
            Schema::table('payments', fn (Blueprint $table) => $table->unique('booking_id'));
            Schema::table('payments', fn (Blueprint $table) => $table->dropIndex('payments_booking_id_index'));
        }
    }
};
