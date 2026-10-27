<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->string('payment_method', 32)->nullable()->after('total_price')->index();
        });

        // Preserve the latest supported method for existing bookings when it
        // can be inferred. Legacy card rows remain readable without assigning
        // a new supported method to the booking.
        DB::table('bookings')->orderBy('id')->chunkById(200, function ($bookings): void {
            foreach ($bookings as $booking) {
                $method = DB::table('payments')->where('booking_id', $booking->id)->orderByDesc('id')->value('payment_method');
                if (in_array($method, ['bank_transfer', 'cash'], true)) {
                    DB::table('bookings')->where('id', $booking->id)->update(['payment_method' => $method]);
                }
            }
        });

        Schema::create('workspace_bank_transfer_details', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('beneficiary_name', 150);
            $table->string('bank_name', 120);
            $table->text('account_identifier');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_bank_transfer_details');
        Schema::table('bookings', function (Blueprint $table): void {
            $table->dropIndex(['payment_method']);
            $table->dropColumn('payment_method');
        });
    }
};
