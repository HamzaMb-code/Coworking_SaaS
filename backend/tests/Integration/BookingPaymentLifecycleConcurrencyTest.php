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
use App\Services\BookingService;
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
    fwrite(STDERR, "This integration test requires MySQL/InnoDB.\n");
    exit(2);
}
$databaseName = DB::connection()->getDatabaseName();
$approvedDatabase = (string) (getenv('BOOKING_CONCURRENCY_TEST_DATABASE') ?: '');
if ($approvedDatabase === '' || $databaseName !== $approvedDatabase || !str_ends_with($databaseName, '_test')) {
    fwrite(STDERR, "Refusing to run: use a dedicated DB_DATABASE and BOOKING_CONCURRENCY_TEST_DATABASE with the same name ending in _test.\n");
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
if (!Schema::hasColumn('bookings', 'payment_deadline_at') || !Schema::hasColumn('bookings', 'payment_method') || !Schema::hasTable('booking_lifecycle_events')) {
    fwrite(STDERR, "Apply booking/payment migrations to the dedicated test database first.\n");
    exit(2);
}

if ($worker) {
    $ready = (string) getenv('LIFECYCLE_RACE_READY');
    $barrier = (string) getenv('LIFECYCLE_RACE_BARRIER');
    $output = (string) getenv('LIFECYCLE_RACE_RESULT');
    file_put_contents($ready, 'ready');
    $deadline = microtime(true) + 30;
    while (!is_file($barrier) && microtime(true) < $deadline) usleep(10_000);
    if (!is_file($barrier)) { file_put_contents($output, json_encode(['error' => 'barrier timeout'])); exit(3); }
    try {
        $action = (string) getenv('LIFECYCLE_RACE_ACTION');
        $bookingId = (int) getenv('LIFECYCLE_RACE_BOOKING');
        $staffId = (int) getenv('LIFECYCLE_RACE_STAFF');
        if ($action === 'approve') {
            $result = app(PaymentService::class)->markAsPaid(Payment::query()->findOrFail((int) getenv('LIFECYCLE_RACE_PAYMENT')), $staffId);
            $result = ['approved' => $result['approved']];
        } elseif ($action === 'expire') {
            $result = ['expired' => app(BookingService::class)->expireIfPaymentDeadlinePassed($bookingId)];
        } elseif ($action === 'cancel') {
            $result = ['status' => app(BookingService::class)->cancel(Booking::query()->findOrFail($bookingId), $staffId)->status->value];
        } elseif ($action === 'reject') {
            $result = ['status' => app(BookingService::class)->reject(Booking::query()->findOrFail($bookingId), $staffId)->status->value];
        } else {
            throw new RuntimeException('Unknown race action.');
        }
        file_put_contents($output, json_encode($result));
        exit(0);
    } catch (ValidationException $exception) {
        file_put_contents($output, json_encode(['rejected' => $exception->errors()]));
        exit(0);
    } catch (Throwable $exception) {
        file_put_contents($output, json_encode(['error' => $exception::class.': '.$exception->getMessage()]));
        exit(1);
    }
}

$users = [];
$workspace = null;
$resource = null;
$fixtures = [];
$directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'booking-lifecycle-race-'.bin2hex(random_bytes(8));
mkdir($directory, 0700, true);

try {
    $users = [User::factory()->create(), User::factory()->create(), User::factory()->create(), User::factory()->create()];
    $workspace = Workspace::factory()->create();
    WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $users[1]->id, 'role' => WorkspaceMemberRole::OWNER]);
    WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $users[2]->id, 'role' => WorkspaceMemberRole::STAFF]);
    WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $users[3]->id, 'role' => WorkspaceMemberRole::STAFF]);
    $resource = Resource::factory()->create([
        'workspace_id' => $workspace->id, 'price' => 100, 'pricing_unit' => PricingUnit::HOUR,
        'type' => ResourceType::MEETING_ROOM, 'status' => ResourceStatus::ACTIVE,
    ]);

    $race = function (string $scenario) use ($directory, $workspace, $resource, $users, &$fixtures): array {
        $start = now()->addDays(10 + count($fixtures))->startOfHour();
        $booking = Booking::query()->create([
            'user_id' => $users[0]->id, 'workspace_id' => $workspace->id, 'resource_id' => $resource->id,
            'start_at' => $start, 'end_at' => $start->copy()->addHour(), 'total_price' => '100.00',
            'status' => BookingStatus::PENDING, 'payment_method' => 'bank_transfer',
            'payment_deadline_at' => $scenario === 'expiration' ? now()->subMinute() : now()->addMinutes(15),
        ]);
        $proofPath = "payment-proofs/lifecycle-race-{$booking->id}.pdf";
        Storage::disk('local')->put($proofPath, 'private test proof');
        $payment = Payment::query()->create([
            'booking_id' => $booking->id, 'amount' => '100.00', 'status' => PaymentStatus::PENDING,
            'payment_method' => 'bank_transfer', 'submitted_at' => now(), 'payment_date' => now()->toDateString(), 'proof_path' => $proofPath,
        ]);
        $fixtures[] = compact('booking', 'payment', 'proofPath');

        $barrier = $directory.DIRECTORY_SEPARATOR.$scenario.'-go';
        $processes = [];
        $actions = ['approve', $scenario === 'expiration' ? 'expire' : $scenario];
        foreach ($actions as $index => $action) {
            $ready = $directory.DIRECTORY_SEPARATOR.$scenario.'-ready-'.$index;
            $resultPath = $directory.DIRECTORY_SEPARATOR.$scenario.'-result-'.$index;
            $environment = getenv();
            $environment['APP_ENV'] = 'testing';
            $environment['LIFECYCLE_RACE_ACTION'] = $action;
            $environment['LIFECYCLE_RACE_BOOKING'] = (string) $booking->id;
            $environment['LIFECYCLE_RACE_PAYMENT'] = (string) $payment->id;
            $environment['LIFECYCLE_RACE_STAFF'] = (string) $users[$index + 1]->id;
            $environment['LIFECYCLE_RACE_READY'] = $ready;
            $environment['LIFECYCLE_RACE_BARRIER'] = $barrier;
            $environment['LIFECYCLE_RACE_RESULT'] = $resultPath;
            $pipes = [];
            $process = proc_open([PHP_BINARY, __FILE__, '--worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__, 2), $environment);
            if (!is_resource($process)) throw new RuntimeException("Could not start {$action} worker for {$scenario}.");
            fclose($pipes[0]);
            $processes[] = compact('process', 'pipes', 'ready', 'resultPath', 'action');
        }
        $readyDeadline = microtime(true) + 30;
        while (microtime(true) < $readyDeadline && count(array_filter($processes, fn ($item) => is_file($item['ready']))) !== 2) usleep(10_000);
        if (count(array_filter($processes, fn ($item) => is_file($item['ready']))) !== 2) throw new RuntimeException("{$scenario} race workers did not reach the barrier.");
        file_put_contents($barrier, 'start');
        foreach ($processes as $item) {
            $stdout = stream_get_contents($item['pipes'][1]);
            $stderr = stream_get_contents($item['pipes'][2]);
            fclose($item['pipes'][1]); fclose($item['pipes'][2]);
            if (proc_close($item['process']) !== 0) throw new RuntimeException("{$scenario} worker {$item['action']} failed: ".trim($stderr ?: $stdout));
        }
        $results = array_map(fn ($item) => json_decode((string) file_get_contents($item['resultPath']), true), $processes);
        foreach ($results as $result) if (isset($result['error'])) throw new RuntimeException("{$scenario} race failed: {$result['error']}");
        return $results;
    };

    $expiryResults = $race('expiration');
    $expiryBooking = $fixtures[0]['booking']->fresh();
    $expiryPayment = $fixtures[0]['payment']->fresh();
    if ($expiryBooking->status !== BookingStatus::CONFIRMED || $expiryPayment->status !== PaymentStatus::PAID
        || !in_array(['expired' => false], $expiryResults, true)) {
        throw new RuntimeException('A pending bank-transfer review must be protected from cash-deadline expiration while approval succeeds. '.json_encode($expiryResults));
    }
    fwrite(STDOUT, "PASS: MySQL/InnoDB bank-transfer approval raced with expiration; the review hold remained protected and the booking confirmed after approval.\n");

    foreach (['cancel', 'reject'] as $transition) {
        $results = $race($transition);
        $fixture = end($fixtures);
        $booking = $fixture['booking']->fresh();
        $payment = $fixture['payment']->fresh();
        $allowed = $transition === 'cancel'
            ? $booking->status === BookingStatus::CANCELLED && in_array($payment->status, [PaymentStatus::FAILED, PaymentStatus::PAID], true)
            : ($booking->status === BookingStatus::REJECTED && $payment->status === PaymentStatus::FAILED)
                || ($booking->status === BookingStatus::CONFIRMED && $payment->status === PaymentStatus::PAID);
        if (!$allowed) throw new RuntimeException("{$transition} race left an invalid payment/booking state: {$booking->status->value}/{$payment->status->value}; ".json_encode($results));
        if ($payment->status === PaymentStatus::PAID && $booking->status !== BookingStatus::CANCELLED && $booking->status !== BookingStatus::CONFIRMED) {
            throw new RuntimeException("{$transition} race left a paid booking in an incompatible state.");
        }
        fwrite(STDOUT, "PASS: MySQL/InnoDB bank-transfer approval raced with booking {$transition}; resource/booking/payment locks serialized the outcome.\n");
    }
} finally {
    foreach ($fixtures as $fixture) {
        $fixture['payment']->refresh();
        if ($fixture['payment']->receipt_path) Storage::disk('local')->delete($fixture['payment']->receipt_path);
        Storage::disk('local')->delete($fixture['proofPath']);
        DB::table('payments')->where('id', $fixture['payment']->id)->delete();
        DB::table('booking_lifecycle_events')->where('booking_id', $fixture['booking']->id)->delete();
        DB::table('notifications')->where('data->booking_id', $fixture['booking']->id)->delete();
        DB::table('bookings')->where('id', $fixture['booking']->id)->delete();
    }
    if ($resource) $resource->delete();
    if ($workspace) $workspace->forceDelete();
    foreach ($users as $user) DB::table('users')->where('id', $user->id)->delete();
    foreach (glob($directory.DIRECTORY_SEPARATOR.'*') ?: [] as $path) @unlink($path);
    @rmdir($directory);
}
