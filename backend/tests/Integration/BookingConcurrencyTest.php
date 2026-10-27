<?php

use App\Models\Booking;
use App\Models\Resource;
use App\Models\User;
use App\Models\Workspace;
use App\PricingUnit;
use App\ResourceStatus;
use App\ResourceType;
use App\Services\BookingService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
if (!Schema::hasColumn('bookings', 'payment_deadline_at')) {
    fwrite(STDERR, "The dedicated test database has not been migrated. Run migrations on that test database first.\n");
    exit(2);
}
$engines = DB::table('information_schema.tables')->where('table_schema', $databaseName)
    ->whereIn('table_name', ['bookings', 'resources'])->pluck('engine', 'table_name');
if (strtolower((string) $engines->get('bookings')) !== 'innodb'
    || strtolower((string) $engines->get('resources')) !== 'innodb') {
    fwrite(STDERR, "This integration test requires InnoDB bookings and resources tables for transactional row locks.\n");
    exit(2);
}

if ($worker === '--worker') {
    $barrier = (string) getenv('BOOKING_CONCURRENCY_BARRIER');
    $ready = (string) getenv('BOOKING_CONCURRENCY_READY');
    $result = (string) getenv('BOOKING_CONCURRENCY_RESULT');
    file_put_contents($ready, 'ready');
    $deadline = microtime(true) + 30;
    while (!is_file($barrier) && microtime(true) < $deadline) {
        usleep(10_000);
    }
    if (!is_file($barrier)) {
        file_put_contents($result, 'worker timed out waiting at barrier');
        exit(3);
    }

    try {
        $user = User::query()->findOrFail((int) getenv('BOOKING_CONCURRENCY_USER'));
        $workspace = Workspace::query()->findOrFail((int) getenv('BOOKING_CONCURRENCY_WORKSPACE'));
        $booking = app(BookingService::class)->create($user, $workspace, [
            'resource_id' => (int) getenv('BOOKING_CONCURRENCY_RESOURCE'),
            'start_at' => (string) getenv('BOOKING_CONCURRENCY_START'),
            'end_at' => (string) getenv('BOOKING_CONCURRENCY_END'),
        ]);
        file_put_contents($result, 'created:'.$booking->id);
        exit(0);
    } catch (Illuminate\Validation\ValidationException $exception) {
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
$processes = [];
$barrierDirectory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'booking-concurrency-'.bin2hex(random_bytes(8));
mkdir($barrierDirectory, 0700, true);

try {
    $users = [User::factory()->create(), User::factory()->create()];
    $workspace = Workspace::factory()->create();
    $resource = Resource::factory()->create([
        'workspace_id' => $workspace->id,
        'price' => 100,
        'pricing_unit' => PricingUnit::HOUR,
        'type' => ResourceType::MEETING_ROOM,
        'status' => ResourceStatus::ACTIVE,
    ]);
    $start = now()->addDays(2)->startOfHour();
    if (!$start->greaterThan(now())) {
        $start->addDay();
    }
    $end = $start->copy()->addHour();
    $barrier = $barrierDirectory.DIRECTORY_SEPARATOR.'go';
    foreach ($users as $index => $user) {
        $ready = $barrierDirectory.DIRECTORY_SEPARATOR.'ready-'.$index;
        $result = $barrierDirectory.DIRECTORY_SEPARATOR.'result-'.$index;
        $environment = getenv();
        $environment['APP_ENV'] = 'testing';
        $environment['BOOKING_CONCURRENCY_BARRIER'] = $barrier;
        $environment['BOOKING_CONCURRENCY_READY'] = $ready;
        $environment['BOOKING_CONCURRENCY_RESULT'] = $result;
        $environment['BOOKING_CONCURRENCY_USER'] = (string) $user->id;
        $environment['BOOKING_CONCURRENCY_WORKSPACE'] = (string) $workspace->id;
        $environment['BOOKING_CONCURRENCY_RESOURCE'] = (string) $resource->id;
        $environment['BOOKING_CONCURRENCY_START'] = $start->toDateTimeString();
        $environment['BOOKING_CONCURRENCY_END'] = $end->toDateTimeString();
        $pipes = [];
        $process = proc_open([PHP_BINARY, __FILE__, '--worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__, 2), $environment);
        if (!is_resource($process)) {
            throw new RuntimeException('Could not start booking worker process.');
        }
        fclose($pipes[0]);
        $processes[] = ['process' => $process, 'pipes' => $pipes, 'ready' => $ready, 'result' => $result];
    }

    $readyDeadline = microtime(true) + 30;
    while (microtime(true) < $readyDeadline) {
        if (count(array_filter($processes, fn ($process) => is_file($process['ready']))) === count($processes)) {
            break;
        }
        usleep(10_000);
    }
    if (count(array_filter($processes, fn ($process) => is_file($process['ready']))) !== count($processes)) {
        throw new RuntimeException('Both workers did not reach the start barrier.');
    }
    file_put_contents($barrier, 'start');

    foreach ($processes as $process) {
        $stdout = stream_get_contents($process['pipes'][1]);
        $stderr = stream_get_contents($process['pipes'][2]);
        fclose($process['pipes'][1]);
        fclose($process['pipes'][2]);
        $exitCode = proc_close($process['process']);
        if ($exitCode !== 0) {
            throw new RuntimeException('Booking worker failed: '.trim($stderr ?: $stdout));
        }
    }

    $results = array_map(fn ($process) => is_file($process['result']) ? file_get_contents($process['result']) : 'missing result', $processes);
    $created = array_values(array_filter($results, fn ($result) => str_starts_with($result, 'created:')));
    $rejected = array_values(array_filter($results, fn ($result) => str_starts_with($result, 'rejected:')));
    $overlaps = Booking::query()->where('resource_id', $resource->id)
        ->whereIn('status', [App\BookingStatus::PENDING, App\BookingStatus::CONFIRMED, App\BookingStatus::CHECKED_IN])
        ->where('start_at', '<', $end)->where('end_at', '>', $start)->count();

    if (count($created) !== 1 || count($rejected) !== 1 || $overlaps !== 1) {
        throw new RuntimeException('Expected one created booking, one rejected attempt, and one active reservation. Results: '.json_encode($results).'; active overlaps='.$overlaps);
    }
    fwrite(STDOUT, "PASS: simultaneous MySQL booking attempts produced one reservation and one overlap rejection.\n");
} finally {
    if (isset($barrier)) {
        @file_put_contents($barrier, 'release');
    }
    foreach ($processes as $process) {
        if (is_resource($process['process'])) {
            foreach ($process['pipes'] as $pipe) {
                if (is_resource($pipe)) {
                    @fclose($pipe);
                }
            }
            @proc_terminate($process['process']);
            @proc_close($process['process']);
        }
    }
    foreach (glob($barrierDirectory.DIRECTORY_SEPARATOR.'*') ?: [] as $path) {
        @unlink($path);
    }
    @rmdir($barrierDirectory);
    if ($workspace) {
        DB::table('bookings')->where('workspace_id', $workspace->id)->delete();
        if ($resource) {
            $resource->delete();
        }
        $workspace->forceDelete();
    }
    foreach ($users as $user) {
        DB::table('users')->where('id', $user->id)->delete();
    }
}
