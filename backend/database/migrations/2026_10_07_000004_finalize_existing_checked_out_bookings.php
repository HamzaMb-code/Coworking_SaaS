<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('bookings')
            ->where('status', 'checked_out')
            ->update(['status' => 'completed']);
    }

    public function down(): void
    {
        // This data correction is intentionally irreversible: completed bookings
        // may include records created after this migration ran.
    }
};
