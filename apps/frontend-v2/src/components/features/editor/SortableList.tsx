import { useState, type ReactNode } from "react";

type DragHandle = {
  onPointerDown: () => void;
  onPointerUp: () => void;
};

/**
 * Lightweight, dependency-free sortable list using native HTML5 drag-and-drop.
 *
 * Dragging is gated to an explicit handle: the card is only `draggable` while
 * the handle's pointer is held (armed via `handle.onPointerDown`). This keeps
 * text selection inside the card's inputs working normally — only the grip
 * starts a drag. If the pointer is released without dragging, `onPointerUp`
 * disarms the row; a completed drag is disarmed by `onDragEnd`.
 *
 * Items are keyed by index, which is correct here because every field is a
 * controlled input bound to the reordered data: after a reorder React simply
 * rebinds each slot to its new item's values.
 */
export function SortableList<T>({
  items,
  onReorder,
  className,
  itemClassName,
  renderItem,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  className?: string;
  itemClassName?: string;
  renderItem: (item: T, index: number, handle: DragHandle) => ReactNode;
}) {
  const [armedIndex, setArmedIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reset = () => {
    setArmedIndex(null);
    setDragIndex(null);
    setOverIndex(null);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <div className={className}>
      {items.map((item, i) => {
        const isDragging = dragIndex === i;
        const isDropTarget = overIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <div
            key={i}
            draggable={armedIndex === i}
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overIndex !== i) setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              reset();
            }}
            onDragEnd={reset}
            className={`${itemClassName ?? ""} ${isDragging ? "opacity-50" : ""} ${
              isDropTarget ? "ring-2 ring-indigo-400 ring-offset-1" : ""
            }`}
          >
            {renderItem(item, i, {
              // Arm this row so the next pointer move starts a native drag.
              onPointerDown: () => setArmedIndex(i),
              // Released without dragging — disarm. (A real drag ends via onDragEnd.)
              onPointerUp: () => setArmedIndex(null),
            })}
          </div>
        );
      })}
    </div>
  );
}
