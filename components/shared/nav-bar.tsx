import Image from "next/image";
import Link from "next/link";

export interface NavLink {
  href: string;
  label: string;
}

interface NavBarProps {
  links: NavLink[];
}

export function NavBar({ links }: NavBarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[rgba(27,29,31,0.14)] bg-[rgba(237,232,223,0.92)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-6 md:py-5 lg:px-8">
        <div className="flex items-center gap-3">
          <Image 
            src="/brand/LogoBrand-Monocolor.png" 
            alt="TAGR Holdings Logo" 
            width={100}
            height={100}
            className="h-7 md:h-8 w-auto object-contain"
          />
          <div className="hidden md:block font-serif text-[19px] font-semibold tracking-[0.02em]">
            TAGR <span className="text-[var(--brass)]">Holdings</span>
          </div>
        </div>
        <div className="hidden gap-8 text-[13.5px] font-medium md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[var(--brass)]">
              {link.label}
            </Link>
          ))}
        </div>
        <Link
          href="#contact"
          className="rounded-sm border border-[var(--ink)] px-3 py-1.5 md:px-4 md:py-2 font-mono text-[10px] md:text-[12px] uppercase tracking-[0.04em] transition hover:bg-[var(--ink)] hover:text-[var(--cream)] text-center"
        >
          Contact Us
        </Link>
      </div>
    </nav>
  );
}
