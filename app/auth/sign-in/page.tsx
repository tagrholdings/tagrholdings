import { SignInForm } from "./_components/SignInForm";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-divider bg-surface p-6">
        <span className="font-serif text-lg font-semibold text-ink">TAGR</span>
        <h1 className="mt-1 font-serif text-xl font-semibold text-ink">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">Internal CRM access — Tagr Holdings.</p>
        <SignInForm />
      </div>
    </main>
  );
}
