import { Construction } from "lucide-react";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-10 text-center ring-1 ring-foreground/10">
      <Construction className="size-8 text-muted-foreground" />
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">Dikerjakan pada {phase}.</p>
    </div>
  );
}
