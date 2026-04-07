"use client";

import { useState, useRef } from "react";
import { Tag } from "@/types";
import { cn } from "@/lib/cn";
import { X, Plus } from "lucide-react";
import { ColorSwatch, SWATCH_COLORS } from "./ColorSwatch";

interface TagListProps {
  taskTags: Tag[];
  availableTags?: Tag[];
  onRemoveTag: (tagId: string) => void;
  onAddTag?: (tagId: string) => void;
  onCreateTag?: (name: string, color: string) => Tag;
  showAvailableTags?: boolean;
  showCurrentTags?: boolean;
  showCreateRow?: boolean;
  className?: string;
}

export function TagList({
  taskTags,
  availableTags = [],
  onRemoveTag,
  onAddTag,
  onCreateTag,
  showAvailableTags = true,
  showCurrentTags = true,
  showCreateRow,
  className,
}: TagListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(SWATCH_COLORS[0]);
  const [showSwatch, setShowSwatch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    if (!newTagName.trim() || !onCreateTag || !onAddTag) return;
    const tag = onCreateTag(newTagName.trim(), newTagColor);
    onAddTag(tag.id);
    setNewTagName("");
    setAddOpen(false);
    setShowSwatch(false);
  };

  const toggleAdd = () => {
    const next = !addOpen;
    setAddOpen(next);
    if (next) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setNewTagName("");
      setShowSwatch(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Available tags to add */}
      {showAvailableTags && availableTags.length > 0 && onAddTag && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onAddTag(tag.id)}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <Plus className="w-2.5 h-2.5 text-[var(--text-muted)]" />
            </button>
          ))}
        </div>
      )}

      {/* Current tags */}
      {showCurrentTags && taskTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="relative inline-flex items-center text-xs px-2.5 py-1 rounded-lg text-white group/tag overflow-hidden cursor-default select-none"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              {/* Gradient hover overlay with X */}
              <button
                type="button"
                className="absolute inset-y-0 right-0 left-[30%] flex items-center justify-end px-1.5 opacity-0 group-hover/tag:opacity-100 transition-opacity cursor-pointer"
                style={{ background: `linear-gradient(to right, transparent, ${tag.color})` }}
                onClick={() => onRemoveTag(tag.id)}
                aria-label={`Remove ${tag.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add row — always on its own line, input/swatch toggled via opacity */}
      {(showCreateRow ?? Boolean(onCreateTag && onAddTag)) && (
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <button
            type="button"
            onClick={toggleAdd}
            className={cn(
              "p-1 rounded-lg transition-all cursor-pointer shrink-0",
              addOpen
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            )}
            title={addOpen ? "Cancel" : "Create new tag"}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Input — always rendered, toggled via opacity/pointer-events */}
          <input
            ref={inputRef}
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setAddOpen(false);
                setNewTagName("");
                setShowSwatch(false);
              }
            }}
            className={cn(
              "flex-1 min-w-0 text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] transition-opacity",
              addOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
          />

          {/* Color circle — always rendered, toggled via opacity/pointer-events */}
          <div
            className={cn(
              "relative shrink-0 transition-opacity",
              addOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
          >
            <button
              type="button"
              onClick={() => setShowSwatch((s) => !s)}
              className="w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-sm border border-white/20"
              style={{ backgroundColor: newTagColor }}
            />
            {showSwatch && (
              <div className="absolute bottom-full right-0 mb-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg p-2 z-30">
                <ColorSwatch
                  value={newTagColor}
                  onChange={(c) => {
                    setNewTagColor(c);
                    setShowSwatch(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
