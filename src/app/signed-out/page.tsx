// Shown when someone reaches the app without a session. There is no local
// login — access is granted only by opening the tool from the Internal Portal,
// which hands off an SSO ticket. The Portal URL is optional (NEXT_PUBLIC_PORTAL_URL).
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/$/, "");

export default function SignedOutPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0a0a0c] px-6 text-zinc-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121214] p-8 text-center">
        <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Screencaps</div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-50">Sign in via the Internal Portal</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Screencaps is accessed through the RallyAd Internal Portal. Open the
          portal and choose <span className="font-medium text-zinc-200">Screencaps</span> from
          the Tools menu to sign in.
        </p>
        {PORTAL_URL ? (
          <a
            href={PORTAL_URL}
            className="mt-6 inline-block rounded-xl bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-[#0a0a0c] hover:opacity-90"
          >
            Go to the Internal Portal
          </a>
        ) : null}
      </div>
    </div>
  );
}
