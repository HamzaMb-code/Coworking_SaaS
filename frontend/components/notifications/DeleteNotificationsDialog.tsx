"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeleteNotificationsDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Portal>
      <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
        <AlertDialog.Popup className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-2xl shadow-slate-950/20 outline-none transition duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-700"><AlertTriangle className="size-5" /></div>
          <AlertDialog.Title className="mt-4 text-lg font-semibold tracking-tight text-slate-950">Delete all notifications?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-slate-600">This will permanently remove every notification from your account. This action can&apos;t be undone.</AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} className="h-10 rounded-xl border-slate-200 px-4">Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm} className="h-10 rounded-xl px-4"><Trash2 className="size-4" />{busy ? "Deleting…" : "Delete all"}</Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Viewport>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
