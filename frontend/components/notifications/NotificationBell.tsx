"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, ExternalLink, LoaderCircle } from "lucide-react";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function NotificationBell({ userId }: { userId: number }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  openRef.current = open;

  const loadLatest = useCallback(async () => {
    if (userId <= 0) return;
    setLoading(true);
    setError("");
    try {
      const [page, count] = await Promise.all([
        getNotifications({ page: 1, perPage: 8 }),
        getUnreadNotificationCount(),
      ]);
      setNotifications(page.notifications);
      setUnreadCount(count);
    } catch {
      setError("Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refreshCount = useCallback(async () => {
    if (userId <= 0) return;
    try { setUnreadCount(await getUnreadNotificationCount()); } catch { /* keep the last known count */ }
  }, [userId]);

  useEffect(() => {
    setUnreadCount(0);
    setNotifications([]);
    setOpen(false);
    void refreshCount();
    const interval = window.setInterval(() => {
      void refreshCount();
      if (openRef.current) void loadLatest();
    }, 45_000);
    const onFocus = () => { void refreshCount(); if (openRef.current) void loadLatest(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [userId, refreshCount, loadLatest]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => { window.removeEventListener("keydown", closeOnEscape); document.removeEventListener("mousedown", closeOnOutsideClick); };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadLatest();
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      try {
        const nextCount = await markNotificationRead(notification.id);
        setUnreadCount(nextCount);
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item));
      } catch {
        setError("This notification could not be marked as read. Please try again.");
        return;
      }
    }
    setOpen(false);
    if (notification.url) router.push(notification.url);
  };

  const markAllRead = async () => {
    if (!unreadCount || busy) return;
    setBusy(true);
    setError("");
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setUnreadCount(0);
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? readAt })));
    } catch {
      setError("Notifications could not be marked as read.");
    } finally {
      setBusy(false);
    }
  };

  return <div ref={rootRef} className="relative">
    <button type="button" onClick={toggle} aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-controls="notification-dropdown" className="relative grid size-9 place-items-center rounded-full border border-[#e7eae1] text-slate-600 transition hover:bg-[#f4f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]"><Bell className="size-4" />{unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#176b4d] px-1 text-[10px] font-bold text-white ring-2 ring-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
    {open && <section id="notification-dropdown" aria-label="Latest notifications" className="absolute right-0 z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#dce7de] bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-[#edf1ed] px-4 py-3"><div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div><button type="button" disabled={!unreadCount || busy} onClick={() => void markAllRead()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#176b4d] hover:bg-[#eaf3ed] disabled:opacity-40"><Check className="size-3.5" />Mark all read</button></header>
      {error && <div role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}<button type="button" onClick={() => void loadLatest()} className="ml-2 font-semibold underline">Retry</button></div>}
      {loading ? <div className="space-y-3 p-4" aria-label="Loading notifications">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[#f0f4f0]" />)}</div>
        : notifications.length === 0 ? <p className="px-5 py-9 text-center text-sm text-slate-500">You&apos;re all caught up. Notifications will appear here when something needs your attention.</p>
          : <div className="max-h-[min(60vh,28rem)] overflow-y-auto">{notifications.map((notification) => <button type="button" key={notification.id} onClick={() => void openNotification(notification)} className={`block w-full border-b border-[#f0f3f0] px-4 py-3 text-left transition hover:bg-[#f8faf8] ${notification.is_read ? "bg-white" : "bg-[#f0f7f2]"}`}><span className="flex items-start gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.is_read ? "bg-transparent" : "bg-[#176b4d]"}`} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-sm font-semibold text-[#26332e]">{notification.title}</span>{!notification.is_read && <span className="sr-only">Unread</span>}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span><span className="mt-1.5 block text-[11px] text-slate-400">{timeLabel(notification.created_at)}</span></span>{notification.url && <ExternalLink className="mt-1 size-3.5 shrink-0 text-slate-400" />}</span></button>)}</div>}
      <footer className="border-t border-[#edf1ed] p-2"><Link href="/notifications" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#176b4d] hover:bg-[#eaf3ed]">View all notifications<ExternalLink className="size-3.5" /></Link></footer>
      {busy && <span className="sr-only"><LoaderCircle className="size-4 animate-spin" />Updating notifications</span>}
    </section>}
  </div>;
}
