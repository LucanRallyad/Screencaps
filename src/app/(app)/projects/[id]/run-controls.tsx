"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Square, Loader2 } from "lucide-react";
import { processProjectAction, stopProjectAction } from "@/lib/actions/projects";
import { toast } from "sonner";

export function RunControls({ projectId, isRunning }: { projectId: string; isRunning: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (isRunning) {
    return (
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await stopProjectAction(projectId);
            if ("error" in res) toast.error((res as { error: string }).error);
            else toast.success("Stopping…");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Square />}
        Stop
      </Button>
    );
  }

  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await processProjectAction(projectId);
          if ("error" in res) {
            toast.error(res.error);
            return;
          }
          toast.success("Processing started");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Play />}
      Process
    </Button>
  );
}
