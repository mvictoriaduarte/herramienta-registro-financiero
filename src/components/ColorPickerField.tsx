"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { SOURCE_COLOR_PRESETS } from "@/lib/finance";

function normalizeHex(value: string) {
  const cleaned = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[0-9A-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`;
  }
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
}

export function ColorPickerField({
  name = "color",
  defaultValue = "#0E4A5A",
  label = "Color HEX",
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(() => normalizeHex(defaultValue));

  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <div className="flex gap-2">
        <input
          type="color"
          value={/^#[0-9A-F]{6}$/i.test(value) ? value.toLowerCase() : "#0e4a5a"}
          onChange={(event) => setValue(normalizeHex(event.target.value))}
          className="h-[50px] w-16 cursor-pointer rounded-2xl border border-white/70 bg-white/50 p-1"
          aria-label="Selector de color"
          suppressHydrationWarning
        />
        <Input
          name={name}
          value={value}
          onChange={(event) => setValue(normalizeHex(event.target.value))}
          pattern="^#[0-9A-Fa-f]{6}$"
          placeholder="#0E4A5A"
          required
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {SOURCE_COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="h-7 w-7 rounded-full border border-white/80 shadow-sm transition hover:scale-110"
            style={{ backgroundColor: preset }}
            aria-label={`Usar ${preset}`}
            onClick={() => setValue(preset)}
          />
        ))}
      </div>
    </label>
  );
}
