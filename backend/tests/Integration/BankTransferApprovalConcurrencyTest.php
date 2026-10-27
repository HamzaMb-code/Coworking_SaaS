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

$worker = ($argv[1] ?? null) === '--worker';
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
if (!Schema::hasColumn('bookings', 'payment_deadline_at') || !Schema::hasColumn('payments', 'receipt_path')) {
    fwrite(STDERR, "The dedicated test database is missing booking or bank-transfer payment migrations.\n");
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

if ($worker) {
    $ready = (string) getenv('BANK_APPROVAL_READY');
    $barrier = (string) getenv('BANK_APPROVAL_BARRIER');
    $resultPath = (string) getenv('BANK_APPROVAL_RESULT');
    file_put_contents($ready, 'ready');
    $deadline = microtime(true) + 30;
    while (!is_file($barrier) && microtime(true) < $deadline) usleep(10_000);
    if (!is_file($barrier)) {
        file_put_contents($resultPath, json_encode(['error' => 'barrier timeout']));
        exit(3);
    }
    try {
        $payment = Payment::query()->findOrFail((int) getenv('BANK_APPROVAL_PAYMENT'));
        $result = app(PaymentService::class)->markAsPaid($payment, (int) getenv('BANK_APPROVAL_STAFF'));
        file_put_contents($resultPath, json_encode([
            'approved' => $result['approved'], 'payment_id' => $result['payment']->id,
            'status' => $result['payment']->status->value, 'verified_by' => $result['payment']->verified_by,
        ]));
        exit(0);
    } catch (ValidationException $exception) {
        file_put_contents($resultPath, json_encode(['rejected' => $exception->errors()]));
        exit(0);
    } catch (Throwable $exception) {
        file_put_contents($resultPath, json_encode(['error' => get_class($exception).': '.$exception->getMessage()]));
        exit(1);
    }
}

$users = [];
$workspace = null;
$resource = null;
$booking = null;
$payment = null;
$processes = [];
$directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'bank-approval-'.bin2hex(random_bytes(8));
mkdir($directory, 0700, true);

try {
    $users = [User::factory()->create(), User::factory()->create(), User::factory()->create()];
    $workspace = Workspace::factory()->create();
    WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $users[1]->id, 'role' => WorkspaceMemberRole::OWNER]);
    WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $users[2]->id, 'role' => WorkspaceMemberRole::STAFF]);
    $resource = Resource::factory()->create([
        'workspace_id' => $workspace->id, 'price' => 100, 'pricing_unit' => PricingUnit::HOUR,
        'type' => ResourceType::MEETING_ROOM, 'status' => ResourceStatus::ACTIVE,
    ]);
    $start = now()->addDays(2)->startOfHour();
    $booking = Booking::query()->create([
        'user_id' => $users[0]->id, 'workspace_id' => $workspace->id, 'resource_id' => $resource->id,
        'start_at' => $start, 'end_at' => $start->copy()->addHour(),
        'status' => BookingStatus::PENDING, 'payment_deadline_at' => now()->addMinutes(15), 'total_price' => '100.00',
    ]);
    $proofPath = 'payment-proofs/bank-approval-concurrency-'.$booking->id.'.pdf';
    Storage::disk('local')->put($proofPath, 'private test proof');
    $payment = Payment::query()->create([
        'booking_id' => $booking->id, 'amount' => '100.00', 'status' => PaymentStatus::PENDING,
        'payment_method' => 'bank_transfer', 'submitted_at' => now(), 'payment_date' => now()->toDateString(),
        'proof_path' => $proofPath,
    ]);
    $barrier = $directory.DIRECTORY_SEPARATOR.'go';
    foreach ([1, 2] as $index) {
        $ready = $directory.DIRECTORY_SEPARATOR.'ready-'.$index;
        $resultPath = $directory.DIRECTORY_SEPARATOR.'result-'.$index;
        $environment = getenv();
        $environment['APP_ENV'] = 'testing';
        $environment['BANK_APPROVAL_BARRIER'] = $barrier;
        $environment['BANK_APPROVAL_READY'] = $ready;
        $environment['BANK_APPROVAL_RESULT'] = $resultPath;
        $environment['BANK_APPROVAL_PAYMENT'] = (string) $payment->id;
        $environment['BANK_APPROVAL_STAFF'] = (string) $users[$index]->id;
        $pipes = [];
        $process = proc_open([PHP_BINARY, __FILE__, '--worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__, 2), $environment);
        if (!is_resource($process)) throw new RuntimeException('Could not start bank approval worker process.');
        fclose($pipes[0]);
        $processes[] = ['process' => $process, 'pipes' => $pipes, 'ready' => $ready, 'result' => $resultPath];
    }

    $readyDeadline = microtime(true) + 30;
    while (microtime(true) < $readyDeadline && count(array_filter($processes, fn ($item) => is_file($item['ready']))) !== count($processes)) usleep(10_000);
    if (count(array_filter($processes, fn ($item) => is_file($item['ready']))) !== count($processes)) throw new RuntimeException('Both bank approval workers did not reach the start barrier.');
    file_put_contents($barrier, 'start');

    foreach ($processes as $item) {
        $stdout = stream_get_contents($item['pipes'][1]);
        $stderr = stream_get_contents($item['pipes'][2]);
        fclose($item['pipes'][1]); fclose($item['pipes'][2]);
        $exitCode = proc_close($item['process']);
        if ($exitCode !== 0) throw new RuntimeException('Bank approval worker failed: '.trim($stderr ?: $stdout));
    }
    $results = array_map(fn ($item) => json_decode((string) file_get_contents($item['result']), true), $processes);
    $payments = Payment::query()->where('booking_id', $booking->id)->where('payment_method', 'bank_transfer')->where('status', PaymentStatus::PAID)->get();
    $approvedCount = count(array_filter($results, fn ($result) => ($result['approved'] ?? false) === true));
    $replayCount = count(array_filter($results, fn ($result) => array_key_exists('approved', $result) && $result['approved'] === false));
    $payment->refresh();
    $booking->refresh();
    if (count($results) !== 2 || $approvedCount !== 1 || $replayCount !== 1 || $payments->count() !== 1
        || $payment->verified_by !== $users[1]->id && $payment->verified_by !== $users[2]->id
        || $booking->status !== BookingStatus::CONFIRMED || !$payment->receipt_path
        || !$payment->receipt_number || !Storage::disk('local')->exists($payment->receipt_path)) {
        throw new RuntimeException('Expected one approval, one idempotent replay, one paid record, verified attribution, confirmation, and a single available receipt. Results: '.json_encode($results));
    }
    fwrite(STDOUT, "PASS: concurrent MySQL bank-transfer approvals from different staff produced one paid record, one receipt, and one idempotent replay.\n");
} finally {
    if (isset($barrier)) @file_put_contents($barrier, 'release');
    foreach ($processes as $item) {
        if (is_resource($item['process'])) {
            foreach ($item['pipes'] as $pipe) if (is_resource($pipe)) @fclose($pipe);
            @proc_terminate($item['process']);
            @proc_close($item['process']);
        }
    }
    foreach (glob($directory.DIRECTORY_SEPARATOR.'*') ?: [] as $path) @unlink($path);
    @rmdir($directory);
    if ($payment) {
        $payment->refresh();
        if ($payment->receipt_path) Storage::disk('local')->delete($payment->receipt_path);
        if ($payment->proof_path) Storage::disk('local')->delete($payment->proof_path);
        DB::table('payments')->where('id', $payment->id)->delete();
    }
    if ($booking) DB::table('bookings')->where('id', $booking->id)->delete();
    if ($resource) $resource->delete();
    if ($workspace) $workspace->forceDelete();
    foreach ($users as $user) DB::table('users')->where('id', $user->id)->delete();
}
