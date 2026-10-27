"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getBookings, getMyBookings, getOwnerNotifications } from "@/lib/bookings";
import { getMyInvitations, getWorkspaceInvitationActivity } from "@/lib/invitations";
import { getMyPayments, getPayments } from "@/lib/payments";

export type UnreadCategory = "bookings" | "invitations" | "payments" | "memberUpdates";
type Role = "customer" | "owner" | "staff";
type InteractionKeys = Record<UnreadCategory, string[]>;
type UnreadCounts = Record<UnreadCategory, number>;
type StoredReadState = Record<UnreadCategory, string[]>;

const emptyKeys = (): InteractionKeys => ({ bookings: [], invitations: [], payments: [], memberUpdates: [] });
const emptyCounts: UnreadCounts = { bookings: 0, invitations: 0, payments: 0, memberUpdates: 0 };
const context = createContext<UnreadCounts>(emptyCounts);

function storageKey(userId: number) {
  return `workspace-unread-v1:${userId}`;
}

function getReadState(userId: number): StoredReadState {
  try {
    const value = localStorage.getItem(storageKey(userId));
    if (!value) return { ...emptyKeys() };
    const parsed = JSON.parse(value) as Partial<StoredReadState>;
    return {
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      invitations: Array.isArray(parsed.invitations) ? parsed.invitations : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      memberUpdates: Array.isArray(parsed.memberUpdates) ? parsed.memberUpdates : [],
    };
  } catch {
    return { ...emptyKeys() };
  }
}

function routeCategory(pathname: string, role: Role): UnreadCategory | null {
  if (pathname === "/invitations") return "invitations";
  if (/\/workspaces\/\d+\/members(?:\/|$)/.test(pathname)) return "memberUpdates";
  if (pathname === "/dashboard" && role !== "customer") return "bookings";
  if (pathname === "/owner/workspaces") return "bookings";
  if (pathname === "/bookings" || /\/workspaces\/\d+\/bookings(?:\/|$)/.test(pathname)) return "bookings";
  if (pathname === "/payments" || /\/workspaces\/\d+\/payments(?:\/|$)/.test(pathname)) return "payments";
  return null;
}

function countUnread(keys: InteractionKeys, read: StoredReadState): UnreadCounts {
  return {
    bookings: keys.bookings.filter((key) => !read.bookings.includes(key)).length,
    invitations: keys.invitations.filter((key) => !read.invitations.includes(key)).length,
    payments: keys.payments.filter((key) => !read.payments.includes(key)).length,
    memberUpdates: keys.memberUpdates.filter((key) => !read.memberUpdates.includes(key)).length,
  };
}

export function UnreadBadgeProvider({
  children,
  userId,
  role,
  workspaceId,
  pathname,
}: {
  children: React.ReactNode;
  userId: number;
  role: Role;
  workspaceId?: number;
  pathname: string;
}) {
  const [counts, setCounts] = useState<UnreadCounts>(emptyCounts);
  const keysRef = useRef<InteractionKeys>(emptyKeys());
  const initialRefreshDone = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const refresh = useCallback(async () => {
    if (userId <= 0) return;
    const [invitationResult, bookingResult, paymentResult, responseResult] = await Promise.allSettled([
      getMyInvitations(),
      role === "owner"
        ? getOwnerNotifications().then((response) => response.notifications)
        : role === "staff" && workspaceId
          ? getBookings(workspaceId)
          : getMyBookings(),
      role === "customer"
        ? getMyPayments()
        : workspaceId
          ? getPayments(workspaceId)
          : Promise.resolve([]),
      role === "owner" && workspaceId
        ? getWorkspaceInvitationActivity(workspaceId).then((activity) => activity.responses)
        : Promise.resolve([]),
    ]);

    const next = { ...keysRef.current };
    if (invitationResult.status === "fulfilled") {
      next.invitations = invitationResult.value.map((invitation) => `invitation:${invitation.id}`);
    }
    if (bookingResult.status === "fulfilled") {
      next.bookings = bookingResult.value
        .filter((booking) => role === "customer" || booking.status === "pending")
        .map((booking) => `booking:${booking.id}:${booking.status}`);
    }
    if (paymentResult.status === "fulfilled") {
      next.payments = paymentResult.value
        .filter((payment) => role === "customer" || payment.status === "pending")
        .map((payment) => `payment:${payment.id}:${payment.status}`);
    }
    if (responseResult.status === "fulfilled") {
      next.memberUpdates = responseResult.value
        .filter((response) => !response.response_read_at)
        .map((response) => `invitation-response:${response.id}:${response.accepted_at ?? response.declined_at}`);
    }

    keysRef.current = next;
    const read = getReadState(userId);
    const activeCategory = routeCategory(pathnameRef.current, role);
    if (activeCategory && !initialRefreshDone.current) {
      read[activeCategory] = [...new Set([...read[activeCategory], ...next[activeCategory]])].slice(-500);
      try { localStorage.setItem(storageKey(userId), JSON.stringify(read)); } catch { /* storage may be disabled */ }
    }
    initialRefreshDone.current = true;
    setCounts(countUnread(next, read));
  }, [role, userId, workspaceId]);

  useEffect(() => {
    if (userId <= 0) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(userId)) void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (userId <= 0) return;
    const activeCategory = routeCategory(pathname, role);
    if (!activeCategory) return;
    const read = getReadState(userId);
    read[activeCategory] = [...new Set([...read[activeCategory], ...keysRef.current[activeCategory]])].slice(-500);
    try { localStorage.setItem(storageKey(userId), JSON.stringify(read)); } catch { /* storage may be disabled */ }
    setCounts(countUnread(keysRef.current, read));
  }, [pathname, role, userId]);

  useEffect(() => {
    const onResponsesViewed = (event: Event) => {
      const keys = (event as CustomEvent<string[]>).detail;
      if (!Array.isArray(keys) || userId <= 0) return;
      keysRef.current.memberUpdates = [...new Set([...keysRef.current.memberUpdates, ...keys])];
      const read = getReadState(userId);
      read.memberUpdates = [...new Set([...read.memberUpdates, ...keys])].slice(-500);
      try { localStorage.setItem(storageKey(userId), JSON.stringify(read)); } catch { /* storage may be disabled */ }
      setCounts(countUnread(keysRef.current, read));
    };
    window.addEventListener("workspace-invitation-responses-viewed", onResponsesViewed);
    return () => window.removeEventListener("workspace-invitation-responses-viewed", onResponsesViewed);
  }, [userId]);

  const value = useMemo(() => counts, [counts]);
  return <context.Provider value={value}>{children}</context.Provider>;
}

export function useUnreadCounts() {
  return useContext(context);
}

export function UnreadCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const shown = count > 99 ? "99+" : count;
  return <span aria-label={`${count} unread`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#176b4d] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">{shown}</span>;
}
