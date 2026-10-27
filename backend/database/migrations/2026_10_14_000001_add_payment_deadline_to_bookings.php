<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->dateTime('payment_deadline_at')->nullable()->index();
        });

        DB::table('bookings')->where('status', 'pending')->orderBy('id')->chunkById(200, function ($bookings): void {
            foreach ($bookings as $booking) {
                DB::table('bookings')->where('id', $booking->id)->update([
                    'payment_deadline_at' => Carbon::parse($booking->created_at)->addMinutes(15)->toDateTimeString(),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->dropIndex(['payment_deadline_at']);
            $table->dropColumn('payment_deadline_at');
        });
    }
};
