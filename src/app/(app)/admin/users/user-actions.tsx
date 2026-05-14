"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toggleUserLock, deleteUser } from "@/lib/actions/admin";
import { toast } from "sonner";

export function UserRowActions({
  userId,
  locked,
  email,
  role,
}: {
  userId: string;
  locked: boolean;
  email: string;
  role: "admin" | "user";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isAdmin = role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isAdmin}
          onClick={() =>
            start(async () => {
              const res = await toggleUserLock(userId, !locked);
              if ("error" in res) toast.error(res.error);
              else toast.success(locked ? "Unlocked" : "Locked");
              router.refresh();
            })
          }
        >
          {locked ? <Unlock /> : <Lock />}
          {locked ? "Unlock" : "Lock"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isAdmin}
          className="text-destructive data-[highlighted]:text-destructive"
          onClick={() =>
            start(async () => {
              if (!confirm(`Delete user ${email}? This removes their projects too.`)) return;
              const res = await deleteUser(userId);
              if ("error" in res) toast.error(res.error);
              else toast.success("User deleted");
              router.refresh();
            })
          }
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
