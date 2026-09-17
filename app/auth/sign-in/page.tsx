import Image from "next/image";
import { SignInCard } from "./_components/SignInCard";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <Image
        src="/background/login.png"
        alt=""
        fill
        priority
        className="object-cover"
      />

      <SignInCard />

      <div className="absolute bottom-6 left-6 hidden items-center gap-2 sm:flex">
        <span className="h-px w-6 bg-accent/60" />
        {/* Same type spec as .label-kicker, but brass instead of muted ink —
            that class hardcodes its own color, which a parent text-* class
            can't override. */}
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-accent/80 uppercase">
          Tagr Holdings
        </span>
      </div>
    </main>
  );
}
