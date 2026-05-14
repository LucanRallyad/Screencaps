"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteUserAction } from "@/lib/auth/actions";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

type State = { error?: string; ok?: true; message?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Send />}
      Send invite
    </Button>
  );
}

export function InviteUserForm() {
  const [state, action] = useActionState<State, FormData>(inviteUserAction, {});

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? "Invite sent");
  }, [state]);

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 max-w-2xl">
      <Input name="email" type="email" placeholder="person@company.com" required className="flex-1" />
      <SubmitButton />
    </form>
  );
}
