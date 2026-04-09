"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Tag } from "@/types";
import { cn } from "@/lib/cn";
import { X, Plus, Search } from "lucide-react";
import { ColorSwatch, SWATCH_COLORS } from "./ColorSwatch";
import { AnimatePresence, motion } from "motion/react";

interface TagEditorProps {
  /** Currently applied tags */
  tags: Tag[];
  /** All tags available in the system */
  allTags: Tag[];
  onAddTag?: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag?: (name: string, color: string) => Tag;
  className?: string;
  /** If true, hides the plus button — only shows tags with hover-X removal */
  readOnly?: boolean;
}

type DropPos = {
  top: number;
  left: number;
  openUp: boolean;
};

export function TagEditor({
  tags,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  className,
  readOnly = false,
}: TagEditorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newColor, setNewColor] = useState<string>(SWATCH_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pos, setPos] = useState<DropPos>({ top: 0, left: 0, openUp: false });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const availableTags = allTags.filter((t) => !tags.some((tag) => tag.id === t.id));
  const filteredAvailable = availableTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = allTags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  );
  const canCreate = !!onCreateTag && search.trim().length > 0 && !exactMatch;

  const recalcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 300;
    const menuWidth = 224;
    const gap = 4;
    const vPad = 8;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    const top = openUp ? rect.top - menuHeight - gap : rect.bottom + gap;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - vPad) {
      left = window.innerWidth - menuWidth - vPad;
    }
    if (left < vPad) left = vPad;

    setPos({ top, left, openUp });
  }, []);

  const openDropdown = useCallback(() => {
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setShowColorPicker(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    recalcPos();
    const onResize = () => recalcPos();
    const onMouseDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !contentRef.current?.contains(e.target as Node)
      )
        close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, recalcPos]);

  const handleAdd = (tagId: string) => {
    onAddTag?.(tagId);
    setSearch("");
  };

  const handleCreate = () => {
    if (!canCreate || !onCreateTag) return;
    const tag = onCreateTag(search.trim(), newColor);
    onAddTag?.(tag.id);
    setSearch("");
    setShowColorPicker(false);
    setNewColor(SWATCH_COLORS[0]);
  };

  const showPlusButton = !readOnly && (!!onAddTag || !!onCreateTag);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {/* Current tags */}
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="relative inline-flex items-center text-xs px-2.5 py-1 rounded-lg text-white group/tag overflow-hidden cursor-default select-none"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          {!readOnly && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 left-[30%] flex items-center justify-end px-1.5 opacity-0 group-hover/tag:opacity-100 transition-opacity cursor-pointer"
              style={{
                background: `linear-gradient(to right, transparent, ${tag.color})`,
              }}
              onClick={() => onRemoveTag(tag.id)}
              aria-label={`Remove ${tag.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}

      {/* Plus trigger */}
      {showPlusButton && (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => (open ? close() : openDropdown())}
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors cursor-pointer shrink-0",
              open
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            )}
            aria-label="Add tag"
            aria-expanded={open}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

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
                    style={{
                      position: "fixed",
                      zIndex: 10000,
                      top: pos.top,
                      left: pos.left,
                      width: 224,
                    }}
                    className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {/* Search input */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
                      <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (canCreate) {
                              handleCreate();
                            } else if (filteredAvailable.length === 1) {
                              handleAdd(filteredAvailable[0].id);
                            }
                          }
                        }}
                        placeholder="Search or create..."
                        className="flex-1 text-xs bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-muted)]"
                      />
                    </div>

                    {/* Available tags */}
                    <div className="max-h-44 overflow-y-auto py-1">
                      {filteredAvailable.length > 0 ? (
                        filteredAvailable.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleAdd(tag.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-left"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="flex-1 truncate">{tag.name}</span>
                          </button>
                        ))
                      ) : (
                        !canCreate && (
                          <p className="text-xs text-[var(--text-muted)] px-3 py-4 text-center">
                            {search
                              ? "No matching tags"
                              : availableTags.length === 0
                              ? "All tags added"
                              : "No tags yet"}
                          </p>
                        )
                      )}
                    </div>

                    {/* Create new tag */}
                    {canCreate && (
                      <div className="border-t border-[var(--border)] p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowColorPicker((s) => !s)}
                            className="w-5 h-5 rounded-full shrink-0 cursor-pointer hover:scale-110 transition-transform shadow-sm border border-white/20"
                            style={{ backgroundColor: newColor }}
                            title="Pick color"
                          />
                          <span className="text-xs flex-1 truncate text-[var(--text-muted)]">
                            Create{" "}
                            <strong className="text-[var(--text)]">
                              &ldquo;{search.trim()}&rdquo;
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={handleCreate}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--primary)] text-white text-xs cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </button>
                        </div>
                        {showColorPicker && (
                          <ColorSwatch
                            value={newColor}
                            onChange={(c) => {
                              setNewColor(c);
                              setShowColorPicker(false);
                            }}
                          />
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
        </>
      )}
    </div>
  );
}
