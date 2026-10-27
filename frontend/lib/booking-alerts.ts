const pendingBookingAlertKey = (workspaceId: number) => `pending-booking-alert-seen:${workspaceId}`;

export function getPendingBookingAlertSeenAt(workspaceId: number): string | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  return window.localStorage.getItem(pendingBookingAlertKey(workspaceId));
}

export function markPendingBookingAlertSeen(workspaceId: number): string | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  const seenAt = new Date().toISOString();
  window.localStorage.setItem(pendingBookingAlertKey(workspaceId), seenAt);
  window.dispatchEvent(new CustomEvent("pending-booking-alert-seen", { detail: { workspaceId, seenAt } }));
  return seenAt;
}
