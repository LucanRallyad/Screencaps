"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Plus, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { uploadTargetsAction, clearTargetsAction } from "@/lib/actions/projects";
import { toast } from "sonner";
import type { Target } from "@/lib/db/schema";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  pending: "muted",
  processing: "warning",
  completed: "success",
  no_ad_slots: "warning",
  unreachable: "destructive",
  failed: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Running",
  completed: "Captured",
  no_ad_slots: "No ad slots",
  unreachable: "Unreachable",
  failed: "Failed",
};

export function TargetsPanel({ projectId, targets }: { projectId: string; targets: Target[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function submitFormData(fd: FormData) {
    start(async () => {
      const res = await uploadTargetsAction(projectId, fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added ${res.added} URL${res.added === 1 ? "" : "s"}`);
      setText("");
      router.refresh();
    });
  }

  // File drop → auto-submit immediately, no extra button click needed
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
    onDrop: (files) => {
      if (files.length === 0) return;
      const fd = new FormData();
      fd.set("file", files[0]);
      submitFormData(fd);
    },
  });

  function submitText() {
    if (!text.trim()) {
      toast.error("Paste at least one URL first.");
      return;
    }
    const fd = new FormData();
    fd.set("text", text);
    submitFormData(fd);
  }

  return (
    <Card className="p-5">
      <div className="mb-3">
        <h3 className="text-sm font-medium">Target URLs</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drop a CSV/Excel and it uploads instantly, or paste URLs below and click Add.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
          pending
            ? "border-border opacity-60 pointer-events-none"
            : isDragActive
            ? "border-foreground/40 bg-accent/30"
            : "border-border hover:border-foreground/20"
        }`}
      >
        <input {...getInputProps()} disabled={pending} />
        <div className="flex flex-col items-center gap-1.5">
          {pending ? (
            <Loader2 className="size-5 text-muted-foreground animate-spin" />
          ) : targets.length > 0 ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : (
            <FileSpreadsheet className="size-5 text-muted-foreground" />
          )}
          <p className="text-sm">
            {pending
              ? "Parsing file…"
              : isDragActive
              ? "Drop to upload"
              : "Drop a CSV or Excel file — uploads automatically"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Or paste URLs here, one per line"
          rows={4}
          disabled={pending}
          className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <Button onClick={submitText} disabled={pending || !text.trim()} size="sm">
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Add URLs
          </Button>
          {targets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={async () => {
                if (!confirm(`Remove all ${targets.length} URLs?`)) return;
                await clearTargetsAction(projectId);
                router.refresh();
              }}
            >
              <Trash2 /> Clear all
            </Button>
          )}
        </div>
      </div>

      {targets.length > 0 && (
        <div className="mt-4 border-t border-border -mx-5 px-5 pt-3 max-h-[300px] overflow-y-auto scroll-hide">
          <p className="text-[11px] text-muted-foreground mb-2">{targets.length} URL{targets.length === 1 ? "" : "s"} added</p>
          <ul className="text-sm divide-y divide-border">
            {targets.map((t) => (
              <li key={t.id} className="py-1.5 flex items-center justify-between gap-3 min-w-0">
                <span className="truncate font-mono text-[12px] text-muted-foreground" title={t.url}>{t.url}</span>
                <Badge variant={STATUS_VARIANT[t.status]} className="shrink-0">{STATUS_LABEL[t.status]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
