"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

type DateTimePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  align?: "start" | "end";
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseValue = (value: string) => {
  const [datePart = "", timePart = ""] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : null;
  return { date, time: timePart.slice(0, 5) };
};

export default function DateTimePicker({ id, label, value, onChange, required = false, align = "start" }: DateTimePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const [draftTime, setDraftTime] = useState("");
  const [timeParts, setTimeParts] = useState({ hour: "09", minute: "00", period: "AM" });
  const [timeOptionsOpen, setTimeOptionsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const beginEdit = () => {
    const date = parsed.date ?? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    setDraftDate(date);
    setDraftTime(parsed.time);
    if (parsed.time) {
      const [hours, minutes] = parsed.time.split(":").map(Number);
      setTimeParts({ hour: String(hours % 12 || 12).padStart(2, "0"), minute: pad(minutes), period: hours >= 12 ? "PM" : "AM" });
      setDraftTime(parsed.time);
    } else {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      setTimeParts({ hour: String(hours % 12 || 12).padStart(2, "0"), minute: pad(minutes), period: hours >= 12 ? "PM" : "AM" });
      setDraftTime(`${pad(hours)}:${pad(minutes)}`);
    }
    setTimeOptionsOpen(false);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(true);
  };

  const monthDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - mondayOffset + 1));
  }, [visibleMonth]);

  const apply = () => {
    if (!draftDate || !draftTime) return;
    onChange(`${dateKey(draftDate)}T${draftTime}`);
    setOpen(false);
  };

  const chooseTimePart = (part: "hour" | "minute" | "period", selected: string) => {
    const next = { ...timeParts, [part]: selected };
    setTimeParts(next);
    const hour = Number(next.hour) % 12 + (next.period === "PM" ? 12 : 0);
    setDraftTime(`${pad(hour)}:${next.minute}`);
  };

  const displayValue = parsed.date && parsed.time
    ? `${parsed.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${new Date(2000, 0, 1, Number(parsed.time.slice(0, 2)), Number(parsed.time.slice(3, 5))).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Choose date and time";

  return <div className="relative" ref={rootRef}>
    <label htmlFor={id} className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</label>
    <button id={id} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={open ? () => setOpen(false) : beginEdit} className="mt-2 flex h-11 w-full items-center gap-3 rounded-md border border-input bg-background px-3 text-left text-sm outline-none transition hover:border-[#176b4d]/50 focus-visible:ring-2 focus-visible:ring-[#176b4d]/30">
      <CalendarDays className="size-4 shrink-0 text-[#176b4d]" />
      <span className={value ? "text-foreground" : "text-muted-foreground"}>{displayValue}</span>
      <Clock3 className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </button>
    {open && <div role="dialog" aria-label={`${label} date and time`} className={`absolute ${align === "end" ? "right-0" : "left-0"} top-full z-50 mt-2 max-h-[min(80svh,44rem)] w-[min(600px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border bg-background shadow-xl`}>
      <div className="grid md:grid-cols-[1.35fr_0.9fr]">
        <section className="p-4 sm:p-5" aria-label="Choose a date">
          <div className="flex h-9 items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]"><ChevronLeft className="size-4" /></button>
            <h3 className="text-sm font-semibold">{visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
            <button type="button" aria-label="Next month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]"><ChevronRight className="size-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {monthDays.map((day) => {
              const selected = !!draftDate && dateKey(day) === dateKey(draftDate);
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const today = dateKey(day) === dateKey(new Date());
              return <button key={dateKey(day)} type="button" aria-pressed={selected} onClick={() => setDraftDate(day)} className={`mx-auto grid size-9 place-items-center rounded-full text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] ${selected ? "bg-[#176b4d] text-white" : inMonth ? "text-foreground hover:bg-emerald-50" : "text-muted-foreground/50 hover:bg-muted"} ${today && !selected ? "ring-1 ring-[#176b4d]/40" : ""}`}>{day.getDate()}</button>;
            })}
          </div>
        </section>
        <section className="border-t p-4 md:border-l md:border-t-0 sm:p-5" aria-label="Choose a time">
          <span className="text-sm font-semibold">Time</span>
          <p className="mt-1 text-xs text-muted-foreground">Choose a time for your booking.</p>
          <button type="button" aria-expanded={timeOptionsOpen} onClick={() => setTimeOptionsOpen((current) => !current)} className="mt-4 flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm outline-none hover:border-[#176b4d]/50 focus-visible:ring-2 focus-visible:ring-[#176b4d]/30">
            <span className={draftTime ? "text-foreground" : "text-muted-foreground"}>{draftTime ? new Date(2000, 0, 1, Number(draftTime.slice(0, 2)), Number(draftTime.slice(3, 5))).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Choose a time"}</span>
            <Clock3 className="size-4 text-muted-foreground" />
          </button>
          {timeOptionsOpen && <div className="mt-2 grid grid-cols-[1fr_1fr_0.85fr] gap-1 rounded-xl border bg-background p-2 shadow-md" aria-label="Choose time">
            {[{ key: "hour" as const, options: Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")) }, { key: "minute" as const, options: Array.from({ length: 60 }, (_, index) => pad(index)) }, { key: "period" as const, options: ["AM", "PM"] }].map(({ key, options }) => <div key={key} className="max-h-40 space-y-1 overflow-y-auto overscroll-contain" aria-label={key}>
              {options.map((option) => <button key={option} type="button" aria-pressed={timeParts[key] === option} onClick={() => chooseTimePart(key, option)} className={`w-full rounded-md px-2 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] ${timeParts[key] === option ? "bg-[#176b4d] font-semibold text-white" : "text-foreground hover:bg-emerald-50 hover:text-[#176b4d]"}`}>{option}</button>)}
            </div>)}
          </div>}
          <p className="mt-2 text-xs text-muted-foreground">Availability is confirmed by the workspace.</p>
        </section>
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-3 sm:px-5">
        <span className="mr-auto text-sm text-muted-foreground">{draftDate ? draftDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Select a date"}{draftTime ? ` · ${new Date(2000, 0, 1, Number(draftTime.slice(0, 2)), Number(draftTime.slice(3, 5))).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
        <button type="button" onClick={() => setDraftDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]">Today</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]">Cancel</button>
        <button type="button" onClick={apply} disabled={!draftDate || !draftTime} className="rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#125a40] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] focus-visible:ring-offset-2">Apply</button>
      </footer>
    </div>}
  </div>;
}
