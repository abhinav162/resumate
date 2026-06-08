import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { SortableList } from "./SortableList";

/**
 * Tag-input editor for a resume's skills. Each skill is a removable chip that
 * can be dragged to reorder; a trailing text input adds new skills on Enter or
 * comma. Adding ignores empty strings and case-insensitive duplicates, and
 * Backspace on an empty input removes the last chip.
 */
export function SkillsTagInput({
  value,
  onChange,
  placeholder = "Type a skill and press Enter",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const addSkill = (raw: string) => {
    const skill = raw.trim();
    if (!skill) return;
    const exists = value.some((s) => s.toLowerCase() === skill.toLowerCase());
    if (exists) return;
    onChange([...value, skill]);
  };

  const removeSkill = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(draft);
      setDraft("");
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeSkill(value.length - 1);
    }
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <SortableList
          items={value}
          onReorder={onChange}
          className="flex flex-wrap gap-2"
          renderItem={(skill, i, handle) => (
            <span
              {...handle}
              style={{ touchAction: "none" }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-paper-border bg-paper-bg text-ink-primary text-sm cursor-grab active:cursor-grabbing"
            >
              {skill}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSkill(i);
                }}
                className="text-ink-muted hover:text-red-400"
                aria-label={`Remove ${skill}`}
              >
                <X size={12} />
              </button>
            </span>
          )}
        />
      )}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-paper-bg border border-paper-border rounded px-3 py-2 text-ink-primary text-sm focus:outline-none focus:border-indigo-400"
      />
    </div>
  );
}
