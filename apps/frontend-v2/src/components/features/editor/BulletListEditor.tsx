import { GripVertical, Plus, Trash2 } from "lucide-react";

import { SortableList } from "./SortableList";

/**
 * Per-bullet editor for a list of resume bullet points.
 *
 * Each bullet is its own single-line input with a drag handle (reorder) and a
 * delete button, plus an "Add bullet" action. The value is a `string[]` and
 * `onChange` is invoked on every edit, add, remove, or reorder. Empty bullets
 * are allowed while editing and are not filtered here.
 */
export function BulletListEditor({
  value,
  onChange,
  placeholder,
  addLabel = "Add bullet",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const updateAt = (index: number, text: string) => {
    const next = value.map((bullet, i) => (i === index ? text : bullet));
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...value, ""]);
  };

  return (
    <div className="space-y-3">
      <SortableList
        items={value}
        onReorder={onChange}
        className="space-y-2"
        itemClassName="flex items-center gap-2"
        renderItem={(bullet, i, handle) => (
          <>
            <button
              {...handle}
              type="button"
              style={{ touchAction: "none" }}
              className="text-ink-muted hover:text-ink-primary p-1 cursor-grab active:cursor-grabbing shrink-0"
              title="Drag to reorder"
              aria-label="Drag to reorder bullet"
            >
              <GripVertical size={14} />
            </button>
            <input
              type="text"
              value={bullet}
              placeholder={placeholder}
              onChange={(e) => updateAt(i, e.target.value)}
              className="w-full bg-paper-bg border border-paper-border rounded px-3 py-2 text-ink-primary text-sm focus:outline-none focus:border-indigo-400 placeholder:text-ink-muted"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="text-ink-muted hover:text-red-400 p-1 shrink-0"
              title="Delete bullet"
              aria-label="Delete bullet"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      />
      <button
        type="button"
        onClick={add}
        className="w-full border border-dashed border-paper-border text-ink-secondary hover:text-indigo-600 hover:border-indigo-400 rounded py-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
      >
        <Plus size={14} />
        <span>{addLabel}</span>
      </button>
    </div>
  );
}
