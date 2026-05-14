"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ProjectStatusPolling({
  projectId,
  initialStatus,
}: {
  projectId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!["processing", "queued"].includes(initialStatus)) return;
    const i = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(i);
  }, [projectId, initialStatus, router]);
  return null;
}
