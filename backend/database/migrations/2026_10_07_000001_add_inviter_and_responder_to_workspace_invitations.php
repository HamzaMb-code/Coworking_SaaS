<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->foreignId('invited_by')
                ->nullable()
                ->after('workspace_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('responded_by')
                ->nullable()
                ->after('invited_by')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('response_read_at')->nullable()->after('responded_by');
        });

        DB::table('workspace_invitations')
            ->whereNull('invited_by')
            ->orderBy('id')
            ->chunkById(100, function ($invitations) {
                foreach ($invitations as $invitation) {
                    $ownerId = DB::table('workspace_members')
                        ->where('workspace_id', $invitation->workspace_id)
                        ->where('role', 'owner')
                        ->orderBy('user_id')
                        ->value('user_id');

                    if ($ownerId) {
                        $responseAt = $invitation->accepted_at ?? $invitation->declined_at;
                        DB::table('workspace_invitations')
                            ->where('id', $invitation->id)
                            ->update([
                                'invited_by' => $ownerId,
                                'response_read_at' => $responseAt,
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('responded_by');
            $table->dropConstrainedForeignId('invited_by');
            $table->dropColumn('response_read_at');
        });
    }
};
