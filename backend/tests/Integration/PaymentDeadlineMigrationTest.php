<?php

use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$databaseName = DB::connection()->getDatabaseName();
if (DB::connection()->getDriverName() !== 'mysql'
    || (string) getenv('BOOKING_CONCURRENCY_TEST_DATABASE') !== $databaseName
    || !str_ends_with($databaseName, '_test')) {
    fwrite(STDERR, "Refusing to run: use the dedicated MySQL *_test database configured for booking integration tests.\n");
    exit(2);
}
if (!Schema::hasColumn('bookings', 'payment_deadline_at')) {
    fwrite(STDERR, "The dedicated test database must be migrated before this test.\n");
    exit(2);
}

$migration = require dirname(__DIR__, 2).'/database/migrations/2026_10_14_000001_add_payment_deadline_to_bookings.php';
$user = User::factory()->create();
$workspace = Workspace::factory()->create();
$resource = Resource::factory()->create([
    'workspace_id' => $workspace->id,
    'price' => 100,
    'pricing_unit' => PricingUnit::HOUR,
    'type' => ResourceType::MEETING_ROOM,
    'status' => ResourceStatus::ACTIVE,
]);
$createdAt = '2025-05-10 08:30:00';
$bookingIds = [];

try {
    $migration->down();
    if (Schema::hasColumn('bookings', 'payment_deadline_at')) {
        throw new RuntimeException('Rollback left the payment deadline column in place.');
    }

    foreach (['pending', 'confirmed', 'cancelled'] as $status) {
        $bookingIds[$status] = DB::table('bookings')->insertGetId([
            'user_id' => $user->id,
            'workspace_id' => $workspace->id,
            'resource_id' => $resource->id,
            'start_at' => '2027-05-10 09:30:00',
            'end_at' => '2027-05-10 10:30:00',
            'total_price' => 100,
            'status' => $status,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    $migration->up();
    $pending = DB::table('bookings')->where('id', $bookingIds['pending'])->first();
    $expected = Carbon::parse($createdAt)->addMinutes(15)->toDateTimeString();
    if ($pending->payment_deadline_at !== $expected) {
        throw new RuntimeException("Pending backfill mismatch: expected {$expected}, got {$pending->payment_deadline_at}.");
    }
    foreach (['confirmed', 'cancelled'] as $status) {
        $row = DB::table('bookings')->where('id', $bookingIds[$status])->first();
        if ($row->payment_deadline_at !== null) {
            throw new RuntimeException("Unexpected deadline was written to {$status} booking.");
        }
    }

    $migration->down();
    if (Schema::hasColumn('bookings', 'payment_deadline_at')) {
        throw new RuntimeException('Rollback did not remove the payment deadline column.');
    }
    $migration->up();
    fwrite(STDOUT, "PASS: pending rows backfill to created_at + 15 minutes; non-pending rows remain null; rollback and reapply work.\n");
} finally {
    if (!Schema::hasColumn('bookings', 'payment_deadline_at')) {
        $migration->up();
    }
    if ($bookingIds !== []) {
        DB::table('bookings')->whereIn('id', array_values($bookingIds))->delete();
    }
    $resource->delete();
    $workspace->forceDelete();
    DB::table('users')->where('id', $user->id)->delete();
}
