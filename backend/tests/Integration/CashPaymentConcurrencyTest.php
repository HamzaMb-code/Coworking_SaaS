<?php

use App\BookingStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\PaymentStatus;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\Services\PaymentService;
use App\WorkspaceMemberRole;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$worker = $argv[1] ?? null;
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (DB::connection()->getDriverName() !== 'mysql') {
    fwrite(STDERR, "This integration test requires MySQL.\n");
    exit(2);
}

$databaseName = DB::connection()->getDatabaseName();
$approvedTestDatabase = (string) (getenv('BOOKING_CONCURRENCY_TEST_DATABASE') ?: '');
if ($approvedTestDatabase === '' || $databaseName !== $approvedTestDatabase || !str_ends_with($databaseName, '_test')) {
    fwrite(STDERR, "Refusing to run: point DB_DATABASE and BOOKING_CONCURRENCY_TEST_DATABASE to the same dedicated database ending in _test.\n");
    exit(2);
}
if (!Schema::hasColumn('bookings', 'payment_deadline_at') || !Schema::hasColumn('payments', 'idempotency_key')) {
    fwrite(STDERR, "The dedicated test database is missing booking or cash-payment migrations.\n");
    exit(2);
}
$engines = DB::table('information_schema.tables')->where('table_schema', $databaseName)
    ->whereIn('table_name', ['bookings', 'resources', 'payments'])->pluck('engine', 'table_name');
foreach (['bookings', 'resources', 'payments'] as $table) {
    if (strtolower((string) $engines->get($table)) !== 'innodb') {
        fwrite(STDERR, "This integration test requires InnoDB for {$table}.\n");
        exit(2);
    }
}

if ($worker === '--worker') {
    $barrier = (string) getenv('CASH_CONCURRENCY_BARRIER');
    $ready = (string) getenv('CASH_CONCURRENCY_READY');
    $result = (string) getenv('CASH_CONCURRENCY_RESULT');
    file_put_contents($ready, 'ready');
    $deadline = microtime(true) + 30;
    while (!is_file($barrier) && microtime(true) < $deadline) usleep(10_000);
    if (!is_file($barrier)) {
        file_put_contents($result, 'worker timed out waiting at barrier');
        exit(3);
    }

    try {
        $booking = Booking::query()->findOrFail((int) getenv('CASH_CONCURRENCY_BOOKING'));
        $payment = app(PaymentService::class)->recordCashReceived($booking, [
            'amount' => '100.00',
            'idempotency_key' => (string) getenv('CASH_CONCURRENCY_KEY'),
        ], (int) getenv('CASH_CONCURRENCY_STAFF'));
        file_put_contents($result, ($payment['created'] ? 'created:' : 'replayed:').$payment['payment']->id);
        exit(0);
    } catch (ValidationException $exception) {
        file_put_contents($result, 'rejected:'.json_encode($exception->errors()));
        exit(0);
    } catch (Throwable $exception) {
        file_put_contents($result, 'error:'.get_class($exception).':'.$exception->getMessage());
        exit(1);
    }
}

$users = [];
$workspace = null;
$resource = null;
$booking = null;
$processes = [];
$directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'cash-concurrency-'.bin2hex(random_bytes(8));
mkdir($directory, 0700, true);

try {
    $users = [User::factory()->create(), User::factory()->create(), User::factory()->create(), User::factory()->create()];
    $workspace = Workspace::factory()->create();
    foreach ([2, 3] as $index) {
        WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $users[$index]->id, 'role' => WorkspaceMemberRole::STAFF]);
    }
    $resource = Resource::factory()->create([
        'workspace_id' => $workspace->id,
        'price' => 100,
        'pricing_unit' => PricingUnit::HOUR,
        'type' => ResourceType::MEETING_ROOM,
        'status' => ResourceStatus::ACTIVE,
    ]);
    $start = now()->addDays(2)->startOfHour();
    $booking = Booking::query()->create([
        'user_id' => $users[0]->id,
        'workspace_id' => $workspace->id,
        'resource_id' => $resource->id,
        'start_at' => $start,
        'end_at' => $start->copy()->addHour(),
        'status' => BookingStatus::CONFIRMED,
        'total_price' => '100.00',
    ]);
    $barrier = $directory.DIRECTORY_SEPARATOR.'go';
    foreach ([0, 1] as $index) {
        $ready = $directory.DIRECTORY_SEPARATOR.'ready-'.$index;
        $result = $directory.DIRECTORY_SEPARATOR.'result-'.$index;
        $environment = getenv();
        $environment['APP_ENV'] = 'testing';
        $environment['CASH_CONCURRENCY_BARRIER'] = $barrier;
        $environment['CASH_CONCURRENCY_READY'] = $ready;
        $environment['CASH_CONCURRENCY_RESULT'] = $result;
        $environment['CASH_CONCURRENCY_BOOKING'] = (string) $booking->id;
        $environment['CASH_CONCURRENCY_STAFF'] = (string) $users[$index + 2]->id;
        $environment['CASH_CONCURRENCY_KEY'] = (string) Illuminate\Support\Str::uuid();
        $pipes = [];
        $process = proc_open([PHP_BINARY, __FILE__, '--worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__, 2), $environment);
        if (!is_resource($process)) throw new RuntimeException('Could not start cash payment worker process.');
        fclose($pipes[0]);
        $processes[] = ['process' => $process, 'pipes' => $pipes, 'ready' => $ready, 'result' => $result];
    }

    $readyDeadline = microtime(true) + 30;
    while (microtime(true) < $readyDeadline && count(array_filter($processes, fn ($p) => is_file($p['ready']))) !== count($processes)) usleep(10_000);
    if (count(array_filter($processes, fn ($p) => is_file($p['ready']))) !== count($processes)) throw new RuntimeException('Both cash workers did not reach the start barrier.');
    file_put_contents($barrier, 'start');

    foreach ($processes as $process) {
        $stdout = stream_get_contents($process['pipes'][1]);
        $stderr = stream_get_contents($process['pipes'][2]);
        fclose($process['pipes'][1]); fclose($process['pipes'][2]);
        $exitCode = proc_close($process['process']);
        if ($exitCode !== 0) throw new RuntimeException('Cash worker failed: '.trim($stderr ?: $stdout));
    }
    $results = array_map(fn ($p) => is_file($p['result']) ? file_get_contents($p['result']) : 'missing result', $processes);
    $created = array_values(array_filter($results, fn ($value) => str_starts_with($value, 'created:')));
    $rejected = array_values(array_filter($results, fn ($value) => str_starts_with($value, 'rejected:')));
    $cashPayments = Payment::query()->where('booking_id', $booking->id)->where('payment_method', 'cash')->where('status', PaymentStatus::PAID)->get();
    if (count($created) !== 1 || count($rejected) !== 1 || $cashPayments->count() !== 1) {
        throw new RuntimeException('Expected one successful cash recording and one rejected attempt. Results: '.json_encode($results).'; paid cash rows='.$cashPayments->count());
    }
    fwrite(STDOUT, "PASS: concurrent MySQL cash requests from different staff created one full cash payment and rejected the duplicate.\n");
} finally {
    if (isset($barrier)) @file_put_contents($barrier, 'release');
    foreach ($processes as $process) {
        if (is_resource($process['process'])) {
            foreach ($process['pipes'] as $pipe) if (is_resource($pipe)) @fclose($pipe);
            @proc_terminate($process['process']);
            @proc_close($process['process']);
        }
    }
    foreach (glob($directory.DIRECTORY_SEPARATOR.'*') ?: [] as $path) @unlink($path);
    @rmdir($directory);
    if ($booking) {
        foreach ($booking->payments()->whereNotNull('receipt_path')->pluck('receipt_path') as $path) Storage::disk('local')->delete($path);
        DB::table('payments')->where('booking_id', $booking->id)->delete();
        DB::table('bookings')->where('id', $booking->id)->delete();
    }
    if ($resource) $resource->delete();
    if ($workspace) $workspace->forceDelete();
    foreach ($users as $user) DB::table('users')->where('id', $user->id)->delete();
}
