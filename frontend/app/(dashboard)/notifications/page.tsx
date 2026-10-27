"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ArrowLeft, ArrowRight, Bell, Check, ExternalLink } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationPagination,
} from "@/lib/notifications";

type Filter = "all" | "unread";

function notificationError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Notifications could not be loaded.";
  return error.response?.data?.message ?? "Notifications could not be loaded.";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pagination, setPagination] = useState<NotificationPagination | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getNotifications({ filter, page, perPage: 15 });
      setNotifications(response.notifications);
      setPagination(response.pagination);
      setUnreadCount(response.unread_count);
    } catch (requestError: unknown) {
      setError(notificationError(requestError));
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications, reloadKey]);

  useEffect(() => {
    const refreshQuietly = async () => {
      try {
        const response = await getNotifications({ filter, page, perPage: 15 });
        setNotifications(response.notifications);
        setPagination(response.pagination);
        setUnreadCount(response.unread_count);
      } catch { /* keep the current list visible when background refresh fails */ }
    };
    const interval = window.setInterval(() => void refreshQuietly(), 45_000);
    window.addEventListener("focus", refreshQuietly);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refreshQuietly); };
  }, [filter, page]);

  const markRead = async (notification: AppNotification) => {
    if (notification.is_read || busyId) return;
    setBusyId(notification.id);
    setError("");
    try {
      setUnreadCount(await markNotificationRead(notification.id));
      if (filter === "unread") {
        setPage(1);
        setReloadKey((value) => value + 1);
      } else {
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item));
      }
    } catch (requestError: unknown) {
      setError(notificationError(requestError));
    } finally {
      setBusyId(null);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      setBusyId(notification.id);
      try {
        setUnreadCount(await markNotificationRead(notification.id));
      } catch (requestError: unknown) {
        setError(notificationError(requestError));
        setBusyId(null);
        return;
      }
      setBusyId(null);
    }
    if (notification.url) router.push(notification.url);
    else await loadNotifications();
  };

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setError("");
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      if (filter === "unread") {
        setPage(1);
        setReloadKey((value) => value + 1);
      } else {
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? readAt })));
      }
    } catch (requestError: unknown) {
      setError(notificationError(requestError));
    } finally {
      setMarkingAll(false);
    }
  };

  const changeFilter = (nextFilter: Filter) => { setFilter(nextFilter); setPage(1); };

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#176b4d]">Your updates</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Notifications</h1><p className="mt-2 text-slate-500">Booking and payment updates for your account and workspaces.</p></div><button type="button" disabled={unreadCount === 0 || markingAll} onClick={() => void markAllRead()} className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-[#cbdccf] bg-white px-4 text-sm font-semibold text-[#176b4d] transition hover:bg-[#eaf3ed] disabled:cursor-not-allowed disabled:opacity-40"><Check className="size-4" />{markingAll ? "Marking..." : "Mark all as read"}</button></header>

    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ed] px-4 py-3 sm:px-5"><div role="tablist" aria-label="Notification filters" className="inline-flex rounded-xl bg-[#f4f7f4] p-1"><button type="button" role="tab" aria-selected={filter === "all"} onClick={() => changeFilter("all")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${filter === "all" ? "bg-white text-[#176b4d] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>All</button><button type="button" role="tab" aria-selected={filter === "unread"} onClick={() => changeFilter("unread")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${filter === "unread" ? "bg-white text-[#176b4d] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Unread{unreadCount > 0 && <span className="ml-2 rounded-full bg-[#eaf3ed] px-2 py-0.5 text-xs text-[#176b4d]">{unreadCount}</span>}</button></div><p className="text-sm text-slate-500">{pagination?.total ?? 0} {filter === "unread" ? "unread " : ""}{(pagination?.total ?? 0) === 1 ? "notification" : "notifications"}</p></div>

      {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-2 font-semibold underline">Try again</button></div>}
      {loading ? <div className="space-y-3 p-5" aria-label="Loading notifications">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-[#f0f4f0]" />)}</div>
        : !error && notifications.length === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf3ed] text-[#176b4d]"><Bell className="size-6" /></span><h2 className="mt-4 font-semibold">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</h2><p className="mt-1 text-sm text-slate-500">{filter === "unread" ? "You’re all caught up." : "Updates about bookings and payments will appear here."}</p></div>
          : !error && <div className="divide-y divide-[#edf1ed]">{notifications.map((notification) => <article key={notification.id} className={`flex items-start gap-3 p-4 sm:gap-4 sm:p-5 ${notification.is_read ? "bg-white" : "bg-[#f1f8f3]"}`}><span className={`mt-2 size-2.5 shrink-0 rounded-full ${notification.is_read ? "bg-transparent" : "bg-[#176b4d]"}`} /><div className="min-w-0 flex-1"><button type="button" disabled={busyId === notification.id} onClick={() => void openNotification(notification)} className="block w-full text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#26332e]">{notification.title}</span>{!notification.is_read && <span className="rounded-full bg-[#dcefe1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#176b4d]">Unread</span>}</span><span className="mt-1 block text-sm leading-6 text-slate-600">{notification.message}</span><span className="mt-2 block text-xs text-slate-400">{formatTimestamp(notification.created_at)}</span></button>{notification.url && <button type="button" disabled={busyId === notification.id} onClick={() => void openNotification(notification)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#176b4d] hover:underline">Open related page<ExternalLink className="size-3.5" /></button>}</div>{!notification.is_read && <button type="button" disabled={busyId === notification.id} onClick={() => void markRead(notification)} className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#176b4d] hover:bg-white disabled:opacity-40">Mark read</button>}</article>)}</div>}

      {!loading && !error && pagination && pagination.total > 0 && <div className="flex flex-col gap-3 border-t border-[#edf1ed] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-sm text-slate-500">Page {pagination.current_page} of {pagination.last_page}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dce5df] px-3 text-sm font-semibold disabled:opacity-40"><ArrowLeft className="size-4" />Previous</button><button type="button" disabled={page >= pagination.last_page} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dce5df] px-3 text-sm font-semibold disabled:opacity-40">Next<ArrowRight className="size-4" /></button></div></div>}
    </section>
  </div>;
}
