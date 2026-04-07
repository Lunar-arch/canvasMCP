"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "motion/react";

type DropdownPos = {
  top: number;
  left: number;
  openUp: boolean;
};

interface DropdownProps {
  /** Can be a node or a render function receiving the current open state */
  trigger: React.ReactNode | ((open: boolean) => React.ReactNode);
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  contentClassName?: string;
}

export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
  contentClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, openUp: false });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const recalcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = contentRef.current?.offsetWidth ?? 280;
    const menuHeight = contentRef.current?.offsetHeight ?? 260;
    const gap = 6;
    const viewportPad = 8;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - menuHeight - gap : rect.bottom + gap;
    top = Math.min(Math.max(top, viewportPad), window.innerHeight - menuHeight - viewportPad);

    let left = align === "right" ? rect.right - menuWidth : rect.left;
    if (left + menuWidth > window.innerWidth - viewportPad) {
      left = window.innerWidth - menuWidth - viewportPad;
    }
    if (left < viewportPad) {
      left = viewportPad;
    }

    setPos({ top, left, openUp });
  }, [align]);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    recalcPos();
    const handleViewportChange = () => recalcPos();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, recalcPos]);

  useEffect(() => {
    if (!open) return;
    const handleMouse = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !contentRef.current?.contains(e.target as Node)
      )
        close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        (
          triggerRef.current?.querySelector(
            "[data-dropdown-trigger]"
          ) as HTMLElement
        )?.focus();
      }
    };
    document.addEventListener("mousedown", handleMouse);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouse);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  return (
    <div ref={triggerRef} className={cn("relative", className)}>
      <div
        data-dropdown-trigger
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        tabIndex={-1}
        className="outline-none"
      >
        {typeof trigger === "function" ? trigger(open) : trigger}
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={contentRef}
                initial={{ opacity: 0, scale: 0.96, y: pos.openUp ? 6 : -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: pos.openUp ? 6 : -6 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", zIndex: 10000, top: pos.top, left: pos.left }}
                className={cn(
                  "bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl",
                  contentClassName
                )}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
