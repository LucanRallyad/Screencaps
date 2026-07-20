"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteUser } from "@/lib/actions/admin";
import { toast } from "sonner";

// Locking has moved to the Internal Portal (deactivate the Portal account).
// The only local action left is deleting the tool-side profile + its projects.
export function UserRowActions({
  userId,
  email,
  role,
}: {
  userId: string;
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
