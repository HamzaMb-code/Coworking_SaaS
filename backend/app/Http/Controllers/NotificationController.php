<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'filter' => ['sometimes', 'in:all,unread'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $query = $request->user()->notifications()->latest();
        if (($filters['filter'] ?? 'all') === 'unread') {
            $query->whereNull('read_at');
        }

        $notifications = $query->paginate($filters['per_page'] ?? 15);

        return response()->json([
            'notifications' => collect($notifications->items())->map(fn ($notification) => $this->serialize($notification)),
            'unread_count' => $request->user()->unreadNotifications()->count(),
            'pagination' => [
                'current_page' => $notifications->currentPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'last_page' => $notifications->lastPage(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $ownedNotification = $request->user()->notifications()->whereKey($notification)->firstOrFail();
        $ownedNotification->markAsRead();

        return response()->json([
            'message' => 'Notification marked as read.',
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $marked = $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Notifications marked as read.',
            'marked_count' => $marked,
            'unread_count' => 0,
        ]);
    }

    public function delete(Request $request, string $notification): JsonResponse
    {
        $ownedNotification = $request->user()->notifications()->whereKey($notification)->firstOrFail();
        $ownedNotification->delete();

        return response()->json([
            'message' => 'Notification deleted.',
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function deleteAll(Request $request): JsonResponse
    {
        $deleted = $request->user()->notifications()->delete();

        return response()->json([
            'message' => 'Notifications deleted.',
            'deleted_count' => $deleted,
            'unread_count' => 0,
        ]);
    }

    /** @return array<string, mixed> */
    private function serialize(object $notification): array
    {
        $data = is_array($notification->data) ? $notification->data : [];
        $url = $data['url'] ?? null;
        if (!is_string($url) || !str_starts_with($url, '/') || str_starts_with($url, '//')) {
            $url = null;
        }

        return [
            'id' => $notification->id,
            'type' => $data['event'] ?? $notification->type,
            'title' => $data['title'] ?? 'Notification',
            'message' => $data['message'] ?? '',
            'url' => $url,
            'created_at' => $notification->created_at,
            'read_at' => $notification->read_at,
            'is_read' => $notification->read_at !== null,
        ];
    }
}
