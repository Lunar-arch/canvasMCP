"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

type SelectPos = {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
  maxHeight: number;
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<SelectPos>({ top: 0, left: 0, width: 0, openUp: false, maxHeight: 208 });
  const [mounted, setMounted] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const selected = options.find((o) => o.value === value);

  const recalcPos = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const estHeight = Math.min(320, Math.max(160, options.length * 36 + 8));
    const gap = 6;
    const viewportPad = 8;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < estHeight && spaceAbove > spaceBelow;

    const maxHeight = Math.max(
      120,
      (openUp ? spaceAbove : spaceBelow) - viewportPad
    );
    const listHeight = Math.min(maxHeight, estHeight);

    let left = rect.left;
    if (left + rect.width > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - rect.width - viewportPad);
    }

    const top = openUp ? rect.top - listHeight - gap : rect.bottom + gap;

    setPos({
      top,
      left,
      width: rect.width,
      openUp,
      maxHeight,
    });
  }, [options.length]);

  const openDropdown = useCallback(() => {
    setHighlightedIdx(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [value, options]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlightedIdx(-1);
  }, []);

  const select = useCallback(
    (val: string) => {
      onChange(val);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close]
  );

  useEffect(() => {
    if (!open) return;

    recalcPos();

    const handleViewportChange = () => recalcPos();
    const handle = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      )
        close();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("mousedown", handle);

    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, close, recalcPos]);

  useEffect(() => {
    if (open && highlightedIdx >= 0) {
      listRef.current?.children[highlightedIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlightedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setHighlightedIdx(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightedIdx(options.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIdx >= 0) select(options[highlightedIdx].value);
        break;
      case "Escape":
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        break;
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openDropdown())}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors cursor-pointer text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("truncate", !selected && "text-[var(--text-muted)]")}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selected.color }}
                />
              )}
              {selected.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {mounted &&
        createPortal(
          open ? (
            <ul
              ref={listRef}
              role="listbox"
              style={{
                position: "fixed",
                zIndex: 10000,
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
              }}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-1 max-h-52 overflow-y-auto"
              onKeyDown={handleKeyDown}
            >
              {options.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
                    idx === highlightedIdx
                      ? "bg-[var(--bg-hover)]"
                      : "hover:bg-[var(--bg-hover)]",
                    opt.value === value && "font-medium"
                  )}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => select(opt.value)}
                >
                  {opt.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.value === value && (
                    <Check className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          ) : null,
          document.body
        )}
    </div>
  );
}
