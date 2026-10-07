<?php

use App\Http\Controllers\PaymentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\ResourceController;
use App\Http\Controllers\WorkspaceInvitationController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\WorkspaceMemberController;
use App\Http\Controllers\FavoriteWorkspaceController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/workspaces', [WorkspaceController::class, 'index']);
Route::get(
    'invitations/{token}',
    [WorkspaceInvitationController::class, 'show']
);
Route::post('/payments/provider/webhook', [PaymentController::class, 'providerWebhook']);



Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);

    Route::apiResource('workspaces', WorkspaceController::class)->except(['index']);
    Route::get('my-workspaces', [WorkspaceController::class, 'mine']);
    Route::get('my-bookings', [BookingController::class, 'mine']);
    Route::get('my-payments', [PaymentController::class, 'mine']);
    Route::get('my-favorites', [FavoriteWorkspaceController::class, 'index']);
    Route::get('my-invitations', [WorkspaceInvitationController::class, 'mine']);
    Route::put('workspaces/{workspace}/favorite', [FavoriteWorkspaceController::class, 'store']);
    Route::delete('workspaces/{workspace}/favorite', [FavoriteWorkspaceController::class, 'destroy']);
    Route::get('owner/workspaces', [WorkspaceController::class, 'owned']);
    Route::get('owner/notifications', [BookingController::class, 'notifications']);
    Route::apiResource('workspaces.members', WorkspaceMemberController::class)
        ->parameters([
            'members' => 'workspaceMember',
        ])
        ->scoped();

    Route::post(
        'workspaces/{workspace}/invitations',
        [WorkspaceInvitationController::class, 'store']
    );

    Route::get(
        'workspaces/{workspace}/invitations',
        [WorkspaceInvitationController::class, 'workspaceIndex']
    );

    Route::post(
        'invitations/{token}/accept',
        [WorkspaceInvitationController::class, 'accept']
    );

    Route::post(
        'invitations/{token}/decline',
        [WorkspaceInvitationController::class, 'decline']
    );

    Route::apiResource(
        'workspaces.resources',
        ResourceController::class
    )->scoped();

    Route::get('workspaces/{workspace}/customers', [BookingController::class, 'customers']);
    Route::post('workspaces/{workspace}/bookings/quote', [BookingController::class, 'quote']);

    Route::apiResource(
        'workspaces.bookings',
        BookingController::class
    )->except(['destroy']);

    Route::post(
        'workspaces/{workspace}/bookings/{booking}/confirm',
        [BookingController::class, 'confirm']
    );

    Route::post(
        'workspaces/{workspace}/bookings/{booking}/check-in',
        [BookingController::class, 'checkIn']
    );

    Route::post(
        'workspaces/{workspace}/bookings/{booking}/complete',
        [BookingController::class, 'complete']
    );

    Route::post(
        'workspaces/{workspace}/bookings/{booking}/cancel',
        [BookingController::class, 'cancel']
    );


    Route::get(
        'workspaces/{workspace}/dashboard',
        [DashboardController::class, 'index']
    );


    Route::get(
        'workspaces/{workspace}/payments',
        [PaymentController::class, 'index']
    );

    // Create payment for a booking
    Route::post(
        'workspaces/{workspace}/bookings/{booking}/payment',
        [PaymentController::class, 'store']
    );

    // View payment
    Route::get(
        'workspaces/{workspace}/payments/{payment}',
        [PaymentController::class, 'show']
    );

    // Payment status actions
    Route::post(
        'workspaces/{workspace}/payments/{payment}/paid',
        [PaymentController::class, 'markAsPaid']
    );

    Route::post(
        'workspaces/{workspace}/payments/{payment}/failed',
        [PaymentController::class, 'markAsFailed']
    );

    Route::post(
        'workspaces/{workspace}/payments/{payment}/refund',
        [PaymentController::class, 'refund']
    );


    Route::get('/users', [AuthController::class, 'users']);
});
