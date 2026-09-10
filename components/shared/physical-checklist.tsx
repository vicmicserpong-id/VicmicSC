"use client";

import {
  INTAKE_CHECKLIST,
  checklistKey,
  type ChecklistValue,
  type PhysicalChecklist,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Editor checklist kondisi fisik (Y/N per baris) untuk form intake & edit tiket. */
export function PhysicalChecklistInput({
  value,
  onChange,
}: {
  value: PhysicalChecklist;
  onChange: (next: PhysicalChecklist) => void;
}) {
  function set(key: string, v: ChecklistValue) {
    const next = { ...value };
    if (next[key] === v) delete next[key];
    else next[key] = v;
    onChange(next);
  }

  const answered = Object.keys(value).length;
  const total = INTAKE_CHECKLIST.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {answered}/{total} terisi · ketuk lagi untuk mengosongkan
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {INTAKE_CHECKLIST.map((g) => (
          <div key={g.group} className="flex flex-col overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <p className="bg-muted/60 px-3 py-1.5 text-xs font-semibold">{g.group}</p>
            <div className="divide-y divide-foreground/5">
              {g.items.map((item) => {
                const key = checklistKey(g.group, item);
                const cur = value[key];
                return (
                  <div
                    key={item}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{item}</span>
                    <div className="flex shrink-0 gap-1">
                      {(["Y", "N"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set(key, v)}
                          aria-pressed={cur === v}
                          className={cn(
                            "grid size-7 place-items-center rounded-md text-xs font-semibold transition-colors",
                            cur === v
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:bg-muted/70",
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ringkasan checklist (read-only) untuk halaman detail tiket. */
export function PhysicalChecklistView({ data }: { data: PhysicalChecklist }) {
  const rows = INTAKE_CHECKLIST.flatMap((g) =>
    g.items
      .map((item) => ({ group: g.group, item, key: checklistKey(g.group, item) }))
      .filter((r) => data[r.key] === "Y" || data[r.key] === "N"),
  );
  if (rows.length === 0) return null;

  return (
    <div className="mt-1 grid gap-x-4 text-xs sm:grid-cols-2">
      {rows.map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-2 border-b border-foreground/5 py-1"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {r.group} · {r.item}
          </span>
          <span
            className={cn(
              "shrink-0 font-semibold",
              data[r.key] === "Y" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
            )}
          >
            {data[r.key]}
          </span>
        </div>
      ))}
    </div>
  );
}
