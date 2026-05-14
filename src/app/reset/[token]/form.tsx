"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/lib/auth/actions";
import { Loader2, CheckCircle2 } from "lucide-react";

type State = { error?: string; ok?: true; message?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<State, FormData>(resetPasswordAction, {});
  if (state?.ok) {
    return (
      <>
        <div className="rounded-lg border border-success/20 bg-success/10 p-4 flex gap-3 items-start">
          <CheckCircle2 className="text-success size-5 mt-0.5 shrink-0" />
          <p className="text-sm">{state.message}</p>
        </div>
        <Button asChild className="w-full"><Link href="/login">Sign in</Link></Button>
      </>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      {state?.error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 rounded-md">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
