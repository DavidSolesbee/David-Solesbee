"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { filterQuestionSuggestions, type QuestionDef } from "@/lib/ai/catalog";

export function AskForm({
  questions,
  current,
  action,
}: {
  questions: QuestionDef[];
  current?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const currentDef = questions.find((q) => q.key === current);
  const [query, setQuery] = React.useState(currentDef?.prompt ?? current ?? "");
  const [pickedKey, setPickedKey] = React.useState<string | null>(currentDef?.key ?? null);
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);

  const suggestions = filterQuestionSuggestions(query, questions);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(q: QuestionDef) {
    setPickedKey(q.key);
    setQuery(q.prompt);
    setOpen(false);
  }

  return (
    <form action={action} className="sticky top-[7.5rem] z-30 space-y-3 rounded-xl border border-line bg-canvas/95 p-4 shadow-card backdrop-blur-md">
      <input type="hidden" name="question" value={pickedKey ?? query} />
      <div ref={box} className="relative">
        <label htmlFor="ask-query" className="sr-only">
          Ask AI
        </label>
        <input
          id="ask-query"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPickedKey(null);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((i) => Math.max(i - 1, 0));
            }
          }}
          placeholder="Ask about revenue, customers, parts, service, or inventory…"
          className="w-full rounded-lg border border-line-strong bg-surface px-4 py-3 text-base text-ink outline-none ring-forest-500 placeholder:text-ink-faint focus:ring-2"
        />
        {open && suggestions.length > 0 && (
          <ul
            className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface shadow-card"
            role="listbox"
          >
            {suggestions.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === hi}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(s)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm",
                    i === hi ? "bg-sage-50 text-ink" : "text-ink-soft hover:bg-surface-tinted",
                  )}
                >
                  <span className="block font-medium text-ink">{s.prompt}</span>
                  <span className="text-caption text-ink-faint">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!query.trim()}>
          Ask AI
        </Button>
        <p className="text-caption text-ink-faint">
          Suggestions appear as you type. Click one to run it — typed text is not remapped.
        </p>
      </div>
    </form>
  );
}
