import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// ── Popover menu anchored to a trigger element ─────────────────────────────
export function Menu({
  anchor,
  onClose,
  children,
  width,
}: {
  anchor: HTMLElement | { x: number; y: number };
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const rect =
      anchor instanceof HTMLElement
        ? anchor.getBoundingClientRect()
        : { left: anchor.x, bottom: anchor.y, top: anchor.y, right: anchor.x };
    const menuH = ref.current?.offsetHeight ?? 200;
    const menuW = ref.current?.offsetWidth ?? width ?? 200;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 4);
    if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
    setPos({ left, top });
  }, [anchor, width]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="ws-root menu"
      ref={ref}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="ws-root modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ── Tag chip ───────────────────────────────────────────────────────────────
export function Tag({ color, children, onClick }: { color: string; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <span className={`tag ${color}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      {children}
    </span>
  );
}

// ── Star rating ────────────────────────────────────────────────────────────
export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`star${n <= value ? " on" : ""}`}
          onClick={
            onChange &&
            ((e) => {
              e.stopPropagation();
              onChange(n === value ? 0 : n);
            })
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function formatCurrency(v: unknown): string {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "";
  const d = new Date(v + "T00:00:00");
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
