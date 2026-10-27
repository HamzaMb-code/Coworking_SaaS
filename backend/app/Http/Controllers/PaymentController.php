<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Http\Requests\UpdatePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Models\CashPaymentReconciliationCase;
use App\Models\Payment;
use App\Models\Workspace;
use App\PaymentStatus;
use App\Services\NotificationService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class PaymentController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $payments = Payment::query()->whereHas('booking', fn ($q) => $q->where('user_id', $request->user()->id))
            ->with(['booking.workspace', 'booking.resource', 'booking.user', 'booking.payments', 'verifier', 'refundVerifier'])
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(min(100, max(1, $request->integer('per_page', 50))));
        return response()->json(['payments' => PaymentResource::collection($payments)->response()->getData(true)]);
    }

    public function index(Request $request, Workspace $workspace): JsonResponse
    {
        Gate::authorize('viewPayments', $workspace);
        Validator::make($request->query(), [
            'status' => ['sometimes', 'in:pending,paid,failed,refunded'],
            'method' => ['sometimes', 'in:card,cash,bank_transfer'],
            'from' => ['sometimes', 'date'], 'to' => ['sometimes', 'date', 'after_or_equal:from'],
            'search' => ['sometimes', 'string', 'max:120'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ])->validate();
        $query = Payment::query()->whereHas('booking', fn ($q) => $q->where('workspace_id', $workspace->id))
            ->with(['booking.user', 'booking.workspace', 'booking.resource', 'booking.payments', 'verifier', 'refundVerifier']);
        if ($request->filled('method')) $query->where('payment_method', $request->query('method'));
        if ($request->filled('from')) $query->whereDate('payment_date', '>=', $request->date('from'));
        if ($request->filled('to')) $query->whereDate('payment_date', '<=', $request->date('to'));
        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(fn ($q) => $q->where('transaction_reference', 'like', $term)
                ->orWhereHas('booking', fn ($b) => $b->where('id', 'like', $term)->orWhereHas('user', fn ($u) => $u->where('name', 'like', $term)->orWhere('email', 'like', $term))));
        }
        $counts = (clone $query)->selectRaw('payments.status, COUNT(*) as aggregate')->groupBy('payments.status')
            ->pluck('aggregate', 'status')->map(fn ($count) => (int) $count);
        foreach (['pending', 'paid', 'failed', 'refunded'] as $status) $counts->put($status, $counts->get($status, 0));
        if ($request->filled('status')) $query->where('status', $request->query('status'));
        $payments = $query->orderByDesc('created_at')->orderByDesc('id')->paginate(min(100, max(1, $request->integer('per_page', 25))));
        return response()->json(['payments' => PaymentResource::collection($payments)->response()->getData(true), 'counts' => $counts]);
    }

    public function store(StorePaymentRequest $request, Workspace $workspace, Booking $booking, PaymentService $service, NotificationService $notifications): JsonResponse
    {
        abort_unless($booking->workspace_id === $workspace->id, 404);
        $payment = new Payment(['booking_id' => $booking->id]);
        $payment->setRelation('booking', $booking->loadMissing('workspace'));
        $data = $request->validated();
        Gate::authorize('create', $payment);
        $proof = $request->file('proof')?->store('payment-proofs', 'local');
        try { $payment = $service->createSubmission($booking, $data, $proof); }
        catch (\Throwable $e) { if ($proof) Storage::disk('local')->delete($proof); throw $e; }
        $notifications->paymentSubmitted($payment);
        return response()->json(['message' => 'Payment submission received and awaiting verification.', 'payment' => new PaymentResource($payment->load(['booking.user','booking.workspace','booking.resource','booking.payments','verifier','refundVerifier']))], 201);
    }

    public function update(UpdatePaymentRequest $request, Workspace $workspace, Payment $payment, PaymentService $service): JsonResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('update', $payment);
        $data = $request->validated(); $proof = $request->file('proof')?->store('payment-proofs', 'local');
        $oldProof = $payment->proof_path;
        try { $payment = $service->updateSubmission($payment, $data, $proof); }
        catch (\Throwable $e) { if ($proof) Storage::disk('local')->delete($proof); throw $e; }
        if ($oldProof && ($proof || $payment->proof_path === null)) Storage::disk('local')->delete($oldProof);
        return response()->json(['message' => 'Pending submission updated.', 'payment' => new PaymentResource($payment->load(['booking.user','booking.workspace','booking.resource','booking.payments','verifier','refundVerifier']))]);
    }

    public function destroy(Workspace $workspace, Payment $payment, PaymentService $service): JsonResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('delete', $payment); $service->deleteSubmission($payment);
        return response()->json(['message' => 'Pending submission deleted.']);
    }

    public function show(Workspace $workspace, Payment $payment): JsonResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('view', $payment);
        return response()->json(['payment' => new PaymentResource($payment->load(['booking.user','booking.workspace','booking.resource','booking.payments','verifier','refundVerifier']))]);
    }

    public function markAsPaid(Request $request, Workspace $workspace, Payment $payment, PaymentService $service, NotificationService $notifications): JsonResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('markAsPaid', $payment);
        Validator::make($request->all(), ['verification_confirmed' => ['required', 'accepted']])->validate();
        $result = $service->markAsPaid($payment, (int) $request->user()->id);
        $payment = $result['payment'];
        if ($result['approved']) {
            try {
                $notifications->paymentStatusChanged($payment, 'paid');
                if (!$result['was_fully_paid'] && $service->summary($payment->booking)['fully_paid']) $notifications->bookingFullyPaid($payment->booking);
                if ($result['booking_status_before'] === \App\BookingStatus::PENDING && $payment->booking->status === \App\BookingStatus::CONFIRMED) $notifications->bookingConfirmed($payment->booking);
            } catch (Throwable $exception) {
                Log::error('Bank transfer was approved but a payment notification failed.', ['payment_id' => $payment->id, 'booking_id' => $payment->booking_id, 'exception' => $exception::class]);
            }
        }
        return response()->json([
            'message' => $result['approved']
                ? ($payment->receipt_path ? 'Payment approved and receipt issued.' : 'Payment approved, but receipt generation failed. Retry approval to generate the receipt.')
                : 'This bank-transfer approval was already recorded.',
            'payment' => new PaymentResource($payment->load('booking.payments')),
        ]);
    }

    public function recordCashReceived(Request $request, Workspace $workspace, Booking $booking, PaymentService $service, NotificationService $notifications): JsonResponse
    {
        abort_unless($booking->workspace_id === $workspace->id, 404);
        Gate::authorize('recordCashReceived', $booking);
        try {
            $data = Validator::make($request->all(), [
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'idempotency_key' => ['required', 'uuid'],
            'cash_received_confirmed' => ['required', 'accepted'],
            'id' => ['prohibited'], 'payment_method' => ['prohibited'], 'status' => ['prohibited'], 'verified_by' => ['prohibited'], 'booking_status' => ['prohibited'],
            'received_by' => ['prohibited'], 'user_id' => ['prohibited'], 'workspace_id' => ['prohibited'], 'booking_id' => ['prohibited'],
            'paid_at' => ['prohibited'], 'verified_at' => ['prohibited'], 'payment_date' => ['prohibited'], 'received_at' => ['prohibited'],
            'receipt_number' => ['prohibited'], 'receipt_path' => ['prohibited'], 'receipt_available' => ['prohibited'],
            'rejection_reason' => ['prohibited'], 'transaction_reference' => ['prohibited'], 'proof_path' => ['prohibited'],
            'submitted_at' => ['prohibited'], 'bank_name' => ['prohibited'], 'proof' => ['prohibited'],
            ])->validate();
        } catch (ValidationException $exception) {
            if ($request->boolean('cash_received_confirmed')) {
                return $this->cashReconciliationResponse($request, $booking, $exception->errors(), 409);
            }
            throw $exception;
        }
        $wasFullyPaid = $service->summary($booking)['fully_paid'];
        $previousBookingStatus = $booking->status;
        try {
            $result = $service->recordCashReceived($booking, $data, (int) $request->user()->id);
        } catch (ValidationException $exception) {
            return $this->cashReconciliationResponse($request, $booking, $exception->errors(), 409);
        } catch (Throwable $exception) {
            $reconciliationReference = (string) $request->input('idempotency_key');
            if (!\Illuminate\Support\Str::isUuid($reconciliationReference)) $reconciliationReference = (string) \Illuminate\Support\Str::uuid();
            Log::critical('Cash was reported received but could not be recorded. Manual reconciliation is required.', [
                'booking_id' => $booking->id,
                'staff_user_id' => $request->user()->id,
                'amount' => $request->input('amount'),
                'idempotency_key' => $request->input('idempotency_key'),
                'exception' => $exception::class,
            ]);
            report($exception);
            $case = $this->recordCashReconciliationCase($request, $booking, ['recording' => ['Unexpected database or booking transition failure.']], $reconciliationReference);
            return response()->json([
                'message' => 'Cash was reported as received, but the payment could not be recorded. Secure the cash and contact the workspace owner for reconciliation. Do not take cash again.',
                'reconciliation_required' => true,
                'reconciliation_reference' => $reconciliationReference,
                'reconciliation_case_id' => $case?->id,
            ], 503);
        }
        $payment = $result['payment'];
        if ($result['created']) {
            try {
                $notifications->paymentStatusChanged($payment, 'paid');
                if (!$wasFullyPaid && $service->summary($payment->booking)['fully_paid']) $notifications->bookingFullyPaid($payment->booking);
                if ($previousBookingStatus === \App\BookingStatus::PENDING && $payment->booking->status === \App\BookingStatus::CONFIRMED) $notifications->bookingConfirmed($payment->booking);
            } catch (Throwable $exception) {
                Log::error('Cash payment was recorded but a notification failed.', ['payment_id' => $payment->id, 'booking_id' => $booking->id, 'exception' => $exception::class]);
            }
        }

        return response()->json([
            'message' => $result['created']
                ? ($payment->receipt_path ? 'Cash payment recorded and receipt issued.' : 'Cash payment recorded, but receipt generation failed. Retry the request to generate it.')
                : 'This cash receipt was already recorded.',
            'payment' => new PaymentResource($payment),
        ], $result['created'] ? 201 : 200);
    }

    public function cashEligibility(Request $request, Workspace $workspace, Booking $booking, PaymentService $service): JsonResponse
    {
        abort_unless($booking->workspace_id === $workspace->id, 404);
        Gate::authorize('recordCashReceived', $booking);
        return response()->json(['cash' => $service->cashEligibility($booking)]);
    }

    private function cashReconciliationResponse(Request $request, Booking $booking, array $errors, int $status): JsonResponse
    {
        $reference = $request->input('idempotency_key') ?: (string) \Illuminate\Support\Str::uuid();
        if (!\Illuminate\Support\Str::isUuid((string) $reference)) $reference = (string) \Illuminate\Support\Str::uuid();
        Log::critical('Cash was reported received but booking/payment validation failed. Manual reconciliation is required.', [
            'booking_id' => $booking->id,
            'staff_user_id' => $request->user()?->id,
            'amount' => $request->input('amount'),
            'idempotency_key' => $reference,
            'validation_errors' => $errors,
        ]);
        $case = $this->recordCashReconciliationCase($request, $booking, $errors, (string) $reference);
        return response()->json([
            'message' => 'Cash was reported as received, but the booking or amount is no longer eligible. Secure the cash and contact the workspace owner for reconciliation. Do not take cash again or confirm this booking.',
            'errors' => $errors,
            'reconciliation_required' => true,
            'reconciliation_reference' => $reference,
            'reconciliation_case_id' => $case?->id,
        ], $status);
    }

    public function cashReconciliations(Workspace $workspace): JsonResponse
    {
        Gate::authorize('viewPayments', $workspace);
        $cases = CashPaymentReconciliationCase::query()->where('workspace_id', $workspace->id)
            ->with(['booking.user', 'staffMember', 'resolver'])->orderByDesc('created_at')->orderByDesc('id')->paginate(50);
        return response()->json(['cases' => $cases]);
    }

    public function resolveCashReconciliation(Request $request, Workspace $workspace, CashPaymentReconciliationCase $case): JsonResponse
    {
        abort_unless($case->workspace_id === $workspace->id, 404);
        abort_unless($workspace->members()->where('user_id', $request->user()->id)->where('role', \App\WorkspaceMemberRole::OWNER)->exists(), 403);
        $data = Validator::make($request->all(), [
            'resolution_notes' => ['required', 'string', 'min:3', 'max:2000'],
        ])->validate();
        $case = \Illuminate\Support\Facades\DB::transaction(function () use ($case, $request, $data): CashPaymentReconciliationCase {
            $locked = CashPaymentReconciliationCase::query()->lockForUpdate()->findOrFail($case->id);
            if ($locked->status === 'resolved') return $locked;
            $locked->update([
                'status' => 'resolved',
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'resolution_notes' => $data['resolution_notes'],
            ]);
            return $locked->fresh(['booking.user', 'staffMember', 'resolver']);
        });
        return response()->json(['message' => 'Cash reconciliation case updated.', 'case' => $case]);
    }

    private function recordCashReconciliationCase(Request $request, Booking $booking, array $errors, string $reference): ?CashPaymentReconciliationCase
    {
        try {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $booking, $errors, $reference): CashPaymentReconciliationCase {
                $existing = CashPaymentReconciliationCase::query()->where('idempotency_key', $reference)->lockForUpdate()->first();
                if ($existing) return $existing;
                return CashPaymentReconciliationCase::query()->create([
                    'booking_id' => $booking->id,
                    'workspace_id' => $booking->workspace_id,
                    'staff_user_id' => $request->user()?->id,
                    'amount' => is_numeric($request->input('amount')) ? $request->input('amount') : null,
                    'idempotency_key' => $reference,
                    'reason' => collect($errors)->flatten()->filter()->implode(' ')
                        ?: 'Cash was reported received but payment recording failed.',
                    'status' => 'open',
                ]);
            });
        } catch (Throwable $exception) {
            Log::critical('Cash reconciliation case could not be persisted; the application log is the only surviving record.', [
                'booking_id' => $booking->id,
                'staff_user_id' => $request->user()?->id,
                'idempotency_key' => $reference,
                'exception' => $exception::class,
            ]);
            return null;
        }
    }

    public function markAsFailed(Request $request, Workspace $workspace, Payment $payment, PaymentService $service, NotificationService $notifications): JsonResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('markAsFailed', $payment);
        $data = Validator::make($request->all(), ['reason' => ['required','string','min:3','max:1000']])->validate();
        $payment = $service->markAsFailed($payment, $data['reason'], (int) $request->user()->id);
        $notifications->paymentStatusChanged($payment, 'failed');
        return response()->json(['message' => 'Payment submission rejected.', 'payment' => new PaymentResource($payment->load('booking.payments'))]);
    }

    public function proof(Workspace $workspace, Payment $payment): StreamedResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('view', $payment);
        abort_unless($payment->proof_path && Storage::disk('local')->exists($payment->proof_path), 404);
        return Storage::disk('local')->download($payment->proof_path, 'payment-proof-'.$payment->id.'.'.pathinfo($payment->proof_path, PATHINFO_EXTENSION));
    }

    public function receipt(Workspace $workspace, Payment $payment): StreamedResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('view', $payment);
        abort_unless(in_array($payment->status, [PaymentStatus::PAID, PaymentStatus::REFUNDED], true)
            && $payment->receipt_path && Storage::disk('local')->exists($payment->receipt_path), 404);
        return Storage::disk('local')->download($payment->receipt_path, $payment->receipt_number.'.pdf');
    }

    public function refund(Request $request, Workspace $workspace, Payment $payment, PaymentService $service, NotificationService $notifications): JsonResponse
    {
        $this->assertWorkspace($workspace, $payment); Gate::authorize('refund', $payment);
        $data = Validator::make($request->all(), [
            'refund_processed' => ['required', 'accepted'],
            'refund_reference' => ['required', 'string', 'min:3', 'max:255'],
        ])->validate();
        $result = $service->refund($payment, (int) $request->user()->id, $data['refund_reference']);
        if ($result['recorded']) $notifications->paymentStatusChanged($result['payment'], 'refunded');
        return response()->json([
            'message' => $result['recorded']
                ? 'External refund recorded. The money movement was handled outside this application.'
                : 'This external refund was already recorded.',
            'payment' => new PaymentResource($result['payment']->load(['booking.payments', 'refundVerifier'])),
        ]);
    }

    public function providerWebhook(Request $request, PaymentService $service, NotificationService $notifications): JsonResponse
    {
        $secret = (string) config('services.payments.webhook_secret'); $signature = (string) $request->header('X-Payment-Signature');
        if ($secret === '' || $signature === '') abort(401, 'Payment webhook signature is missing.');
        $expected = hash_hmac('sha256', $request->getContent(), $secret); $provided = str_starts_with($signature, 'sha256=') ? substr($signature, 7) : $signature;
        if (!hash_equals($expected, $provided)) abort(401, 'Payment webhook signature is invalid.');
        $data = Validator::make($request->json()->all(), ['payment_id'=>'required|integer|exists:payments,id','status'=>'required|in:paid,failed','transaction_reference'=>'required|string|max:255'])->validate();
        $payment = Payment::with('booking')->findOrFail($data['payment_id']); $previous = $payment->status; $previousBookingStatus = $payment->booking->status;
        $before = $service->summary($payment->booking);
        $payment = $service->applyProviderResult($payment, $data['status'], $data['transaction_reference']);
        if ($payment->status !== $previous) {
            $notifications->paymentStatusChanged($payment, $payment->status->value);
            if ($payment->status === PaymentStatus::PAID && !$before['fully_paid'] && $service->summary($payment->booking)['fully_paid']) $notifications->bookingFullyPaid($payment->booking);
            if ($payment->status === PaymentStatus::PAID && $previousBookingStatus === \App\BookingStatus::PENDING && $payment->booking->status === \App\BookingStatus::CONFIRMED) $notifications->bookingConfirmed($payment->booking);
        }
        return response()->json(['message' => 'Provider payment status verified.', 'payment' => new PaymentResource($payment)]);
    }

    private function assertWorkspace(Workspace $workspace, Payment $payment): void
    {
        abort_unless($payment->booking->workspace_id === $workspace->id, 404);
    }
}
