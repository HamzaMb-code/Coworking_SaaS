<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Workspace;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class PaymentController extends Controller
{
    /** List payments attached to the authenticated customer's bookings. */
    public function mine(): JsonResponse
    {
        $payments = Payment::query()
            ->whereHas('booking', fn ($query) =>
                $query->where('user_id', request()->user()->id)
            )
            ->with(['booking.workspace', 'booking.resource', 'booking.user'])
            ->latest()
            ->get();

        return response()->json([
            'payments' => PaymentResource::collection($payments),
        ]);
    }

    public function index(
        Workspace $workspace
    ): JsonResponse {
        Gate::authorize('viewAny', $workspace);

        $payments = Payment::query()
            ->whereHas('booking', function ($query) use ($workspace) {
                $query->where('workspace_id', $workspace->id);
            })
            ->with(['booking.user', 'booking.workspace', 'booking.resource'])
            ->latest()
            ->get();

        return response()->json([
            'payments' => PaymentResource::collection($payments),
        ]);
    }

    public function store(
        StorePaymentRequest $request,
        Workspace $workspace,
        Booking $booking,
        PaymentService $paymentService
    ): JsonResponse {
        if ($booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        $payment = new Payment([
            'booking_id' => $booking->id,
        ]);

        $payment->setRelation('booking', $booking);

        if ($request->validated('payment_method') === 'cash') {
            Gate::authorize('recordOfflinePayment', $payment);
        } else {
            Gate::authorize('create', $payment);
        }

        $payment = $paymentService->create(
            $booking,
            $request->validated('payment_method')
        )->load(['booking.user', 'booking.workspace', 'booking.resource']);

        return response()->json([
            'message' => 'Payment created successfully.',
            'payment' => new PaymentResource($payment),
        ], 201);
    }

    public function show(
        Workspace $workspace,
        Payment $payment
    ): JsonResponse {
        if ($payment->booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('view', $payment);

        $payment->load('booking');

        return response()->json([
            'payment' => new PaymentResource($payment),
        ]);
    }

    public function markAsPaid(
        Workspace $workspace,
        Payment $payment,
        PaymentService $paymentService
    ): JsonResponse {
        if ($payment->booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('markAsPaid', $payment);

        $payment = $paymentService->markAsPaid(
            $payment
        );

        return response()->json([
            'message' => 'Payment marked as paid successfully.',
            'payment' => new PaymentResource($payment),
        ]);
    }

    /** Provider callback. The signature is checked before trusting the payload. */
    public function providerWebhook(Request $request, PaymentService $paymentService): JsonResponse
    {
        $secret = (string) config('services.payments.webhook_secret');
        $signature = (string) $request->header('X-Payment-Signature');
        if ($secret === '' || $signature === '') {
            abort(401, 'Payment webhook signature is missing.');
        }

        $expected = hash_hmac('sha256', $request->getContent(), $secret);
        $provided = str_starts_with($signature, 'sha256=') ? substr($signature, 7) : $signature;
        if (! hash_equals($expected, $provided)) {
            abort(401, 'Payment webhook signature is invalid.');
        }

        $payload = Validator::make($request->json()->all(), [
            'payment_id' => ['required', 'integer', 'exists:payments,id'],
            'status' => ['required', 'in:paid,failed'],
            'transaction_reference' => ['required', 'string', 'max:255'],
        ])->validate();

        $payment = Payment::query()->with('booking')->findOrFail($payload['payment_id']);
        if ($payment->booking->status === \App\BookingStatus::CANCELLED && $payload['status'] === 'paid') {
            abort(409, 'A cancelled booking cannot receive a successful payment.');
        }

        $payment = $paymentService->applyProviderResult(
            $payment,
            $payload['status'],
            $payload['transaction_reference']
        );

        return response()->json([
            'message' => 'Provider payment status verified.',
            'payment' => new PaymentResource($payment),
        ]);
    }

    public function markAsFailed(
        Workspace $workspace,
        Payment $payment,
        PaymentService $paymentService
    ): JsonResponse {
        if ($payment->booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('markAsFailed', $payment);

        $payment = $paymentService->markAsFailed($payment);

        return response()->json([
            'message' => 'Payment marked as failed.',
            'payment' => new PaymentResource($payment),
        ]);
    }

    public function refund(
        Workspace $workspace,
        Payment $payment,
        PaymentService $paymentService
    ): JsonResponse {
        if ($payment->booking->workspace_id !== $workspace->id) {
            abort(404);
        }

        Gate::authorize('refund', $payment);

        $payment = $paymentService->refund($payment);

        return response()->json([
            'message' => 'Payment refunded successfully.',
            'payment' => new PaymentResource($payment),
        ]);
    }
}
