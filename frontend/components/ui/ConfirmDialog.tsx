"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";

export function useConfirmDialog() {
  const [message, setMessage] = useState<string | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setMessage(null);
    resolve?.(confirmed);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const confirm = useCallback((nextMessage: string) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false);
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      resolveRef.current = resolve;
      setMessage(nextMessage);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") settle(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [message, settle]);

  const dialog = message ? (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#102d34]/45 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-lg rounded-[32px] bg-[#eaf3ed] p-3 shadow-[0_28px_90px_rgba(16,45,52,.3)] sm:p-4"
      >
        <div className="rounded-[25px] border border-[#d7e6dc] bg-white p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e8f2eb] text-[#176b4d]">
              <CircleAlert className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="confirm-dialog-title" className="sr-only">Confirm action</h2>
              <p id="confirm-dialog-message" className="pt-1 text-base leading-7 text-[#26332e] sm:text-lg">{message}</p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" autoFocus onClick={() => settle(false)} className="rounded-full border border-[#dce5df] bg-white px-5 py-3 text-sm font-semibold text-[#35443c] transition hover:bg-[#f6f8f6] focus:outline-none focus:ring-4 focus:ring-[#176b4d]/15">Cancel</button>
                <button type="button" onClick={() => settle(true)} className="rounded-full bg-[#b42332] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-red-900/15 transition hover:bg-[#951c29] focus:outline-none focus:ring-4 focus:ring-red-700/20">OK</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, dialog };
}
