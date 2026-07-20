"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { uploadAdsAction, deleteAdAction } from "@/lib/actions/projects";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import type { Ad } from "@/lib/db/schema";

export function AdsPanel({
  projectId,
  ads,
  readOnly = false,
}: {
  projectId: string;
  ads: Ad[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/png": [], "image/jpeg": [], "image/gif": [], "image/webp": [] },
    onDrop: (files) => {
      if (files.length === 0) return;
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      start(async () => {
        const res = await uploadAdsAction(projectId, fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        if (res.failed.length > 0) {
          toast.error(`Saved ${res.saved}, ${res.failed.length} failed`);
        } else {
          toast.success(`Saved ${res.saved} creative${res.saved === 1 ? "" : "s"}`);
        }
        router.refresh();
      });
    },
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium">Ad creatives</h3>
          <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, GIF, or WebP. The size of each image determines which ad slot it can replace.</p>
        </div>
      </div>

      {!readOnly && (
        <div
          {...getRootProps()}
          className={`border border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-foreground/40 bg-accent/30" : "border-border hover:border-foreground/20"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {pending ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <ImagePlus className="size-5 text-muted-foreground" />}
            <p className="text-sm">{isDragActive ? "Drop files here" : "Drop creatives here, or click to choose"}</p>
            <p className="text-[11px] text-muted-foreground">Up to 10 MB each</p>
          </div>
        </div>
      )}

      {ads.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ads.map((ad) => (
            <div key={ad.id} className="relative group rounded-lg border border-border overflow-hidden bg-secondary/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/ads/${ad.id}`} alt={ad.filename} className="w-full h-24 object-contain" />
              <div className="px-2 py-1.5 border-t border-border flex items-center justify-between text-[11px]">
                <Badge variant="muted" className="font-mono">{ad.width}×{ad.height}</Badge>
                <span className="text-muted-foreground">{formatBytes(ad.sizeBytes)}</span>
              </div>
              {!readOnly && (
                <button
                  onClick={async () => {
                    await deleteAdAction(projectId, ad.id);
                    router.refresh();
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1.5 right-1.5 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded p-1"
                  aria-label="Delete creative"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
