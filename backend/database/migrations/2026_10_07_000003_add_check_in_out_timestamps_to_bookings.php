<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('bookings', 'checked_in_at')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->timestamp('checked_in_at')->nullable()->after('end_at');
            });
        }

        if (!Schema::hasColumn('bookings', 'checked_out_at')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->timestamp('checked_out_at')->nullable()->after('checked_in_at');
            });
        }
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['checked_in_at', 'checked_out_at']);
        });
    }
};
