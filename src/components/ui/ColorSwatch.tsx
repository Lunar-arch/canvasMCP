"use client";

import { cn } from "@/lib/cn";

export const SWATCH_COLORS = [
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
] as const;

export type SwatchColor = (typeof SWATCH_COLORS)[number];

interface ColorSwatchProps {
  value?: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorSwatch({ value, onChange, className }: ColorSwatchProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {SWATCH_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "w-5 h-5 rounded-full transition-transform hover:scale-110 cursor-pointer shrink-0",
            value === c && "ring-2 ring-offset-1 ring-current"
          )}
          style={{ backgroundColor: c, color: c }}
          title={c}
        />
      ))}
    </div>
  );
}
