<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->timestamp('response_dismissed_at')->nullable()->after('response_read_at');
        });
    }

    public function down(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->dropColumn('response_dismissed_at');
        });
    }
};
