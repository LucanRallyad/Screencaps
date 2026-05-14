"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

type Props = {
  total: number;       // total target URLs
  settled: number;     // targets that finished (any terminal status)
  startedAt: string | null; // ISO string of when first target began
  isRunning: boolean;
};

function fmt(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export function EtaDisplay({ total, settled, startedAt, isRunning }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!isRunning || total === 0) return null;

  const elapsed = startedAt ? (now - new Date(startedAt).getTime()) / 1000 : 0;
  const remaining = total - settled;

  // Need at least 1 settled target and 10s elapsed before showing an estimate
  let label: string;
  if (settled === 0 || elapsed < 10) {
    label = `Processing… ${settled}/${total} done`;
  } else {
    const rate = settled / elapsed; // targets per second
    const etaSec = rate > 0 ? remaining / rate : null;
    if (etaSec === null || etaSec < 0) {
      label = `${settled}/${total} done`;
    } else if (etaSec < 5) {
      label = `Almost done — ${settled}/${total}`;
    } else {
      label = `~${fmt(etaSec)} remaining — ${settled}/${total} done`;
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="size-3.5 animate-pulse" />
      <span>{label}</span>
    </div>
  );
}
