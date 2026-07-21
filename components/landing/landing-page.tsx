import Link from "next/link";
import Image from "next/image";
import { AnimatedSection } from "@/components/landing/animated-section";
import { ContactForm } from "@/components/landing/contact-form";
import { HeroHeader } from "@/components/shared/hero-header";
import { NavBar } from "@/components/shared/nav-bar";
import { ScrollToTop } from "@/components/shared/scroll-to-top";

const portfolioItems = [
  {
    id: "01",
    name: "Unified",
    description: "Multi-trade home services group — placeholder description.",
    sector: "Home Services",
    est: "EST. ----",
  },
  {
    id: "02",
    name: "Grounded",
    description: "Land, agriculture, or real asset operations — placeholder description.",
    sector: "Land & Real Assets",
    est: "EST. ----",
  },
  {
    id: "03",
    name: "[HVAC Company]",
    description: "Residential and commercial HVAC — placeholder description.",
    sector: "Mechanical / HVAC",
    est: "EST. ----",
  },
  {
    id: "04",
    name: "Menlo Group CRE",
    description: "Commercial real estate brokerage & investment — placeholder description.",
    sector: "Commercial Real Estate",
    est: "EST. ----",
  },
  {
    id: "05",
    name: "Under Consideration",
    description: "We’re always evaluating well-run businesses looking for their next chapter.",
    sector: "Open",
    est: "—",
  },
];

const values = [
  {
    title: "Relationships first",
    copy: "Deals are made between people, not spreadsheets. We stay in business with people we trust for decades, not quarters.",
  },
  {
    title: "Ownership mentality",
    copy: "Every operator we back is treated — and treats their team — like an owner, not a manager passing through.",
  },
  {
    title: "Built to be true",
    copy: "No business under this roof is asked to be something it’s not. Authentic brands compound; imitations don’t.",
  },
  {
    title: "Play the long game",
    copy: "We underwrite for decades, not exits. Patience is the actual competitive advantage nobody wants to admit to.",
  },
];

const operatingPrinciples = [
  {
    title: "Shared Services",
    copy: "Finance, HR, legal and IT support so operators spend their time on customers, not back-office overhead.",
  },
  {
    title: "Leadership Development",
    copy: "Coaching and peer groups across the portfolio so every operator has someone who’s solved their next problem already.",
  },
  {
    title: "Strategic Support",
    copy: "Help on pricing, M&A, and growth planning — brought in when it’s useful, never imposed from the top down.",
  },
  {
    title: "Operating Systems",
    copy: "A common set of tools for reporting and planning, light enough that it helps rather than hinders.",
  },
];

const navLinks = [
  { href: "#portfolio", label: "Portfolio" },
  { href: "#values", label: "Values" },
  { href: "#operate", label: "How We Operate" },
  { href: "#leadership", label: "Leadership" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <NavBar links={navLinks} />

      <HeroHeader
        kicker="A Private Holding Company"
        title={
          <>
            We build businesses that outlast <em className="not-italic text-[#C7A667]">the founders who start them.</em>
          </>
        }
        description="TAGR Holdings acquires and operates companies across real estate, home services, and skilled trades — each one run independently, governed by the same set of principles."
        actions={
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link 
              href="#portfolio" 
              className="rounded-full bg-[var(--brass)] px-6 py-3 text-center font-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink)] transition-colors hover:bg-white"
            >
              View the Portfolio
            </Link>
            <Link 
              href="#values" 
              className="rounded-full border border-[rgba(245,242,236,0.2)] px-6 py-3 text-center font-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--cream)] transition-colors hover:border-[var(--brass)] hover:bg-[rgba(199,166,103,0.05)]"
            >
              Our Principles
            </Link>
          </div>
        }
      >
        <AnimatedSection className="mt-16 grid grid-cols-2 gap-8 border-t border-[rgba(245,242,236,0.1)] pt-10 md:grid-cols-4">
          <div>
            <div className="font-serif text-[32px] text-[var(--cream)]">4</div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(245,242,236,0.55)]">
              Operating Companies
            </div>
          </div>
          <div>
            <div className="font-serif text-[32px] text-[var(--cream)]">3</div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(245,242,236,0.55)]">
              Industries
            </div>
          </div>
          <div>
            <div className="font-serif text-[32px] text-[var(--cream)]">Est.</div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(245,242,236,0.55)]">
              Founder-Led Since Day One
            </div>
          </div>
          <div>
            <div className="font-serif text-[32px] text-[var(--cream)]">∞</div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(245,242,236,0.55)]">
              Time Horizon
            </div>
          </div>
        </AnimatedSection>
      </HeroHeader>

      <section className="border-b border-[rgba(27,29,31,0.14)] px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection>
            <p className="max-w-3xl font-serif text-[clamp(1.35rem,2.4vw,2rem)] leading-[1.45] text-[var(--ink)]">
              “I didn’t want to build one company. I wanted to build a place where good businesses — and the people who run them — could get stronger together.”
            </p>
            <div className="mt-6 font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--slate)]">
              — TANNER, FOUNDER
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section id="portfolio" className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                The Portfolio
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                Independently run. Commonly held.
              </h2>
            </div>
            <p className="max-w-[360px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              Each company below keeps its own name, team, and customers. What they share is capital discipline, leadership support, and a long time horizon.
            </p>
          </AnimatedSection>

          {/* Desktop View (md+) */}
          <div className="hidden border-t border-[rgba(27,29,31,0.14)] md:block">
            {portfolioItems.map((item) => (
              <AnimatedSection key={item.name} className="group grid gap-4 border-b border-[rgba(27,29,31,0.14)] py-7 px-0 transition-all duration-300 ease-in-out hover:bg-[rgba(156,122,60,0.06)] hover:px-4 md:grid-cols-[45px_minmax(0,1.2fr)_1fr_110px_120px_24px] md:items-center">
                <div className="font-mono text-[12px] text-[rgba(27,29,31,0.4)]">{item.id}</div>
                <div className="font-serif text-[23px] font-medium transition-colors group-hover:text-[var(--brass)]">{item.name}</div>
                <div className="text-[14px] leading-[1.5] text-[rgba(27,29,31,0.62)]">{item.description}</div>
                <div className="w-fit rounded-full border border-[rgba(61,74,66,0.3)] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--slate)]">
                  {item.sector}
                </div>
                <div className="font-mono text-[12px] text-[rgba(27,29,31,0.45)]">{item.est}</div>
                <div className="text-right text-[18px] text-[var(--brass)]">→</div>
              </AnimatedSection>
            ))}
          </div>

          {/* Mobile Carousel View (< md) */}
          <div className="md:hidden">
            <div className="-mx-6 flex snap-x snap-mandatory overflow-x-auto px-6 py-2 gap-4 scroll-pl-6 scroll-pr-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {portfolioItems.map((item) => (
                <div 
                  key={item.name} 
                  className="w-[82vw] shrink-0 snap-start rounded-xl border border-[rgba(27,29,31,0.14)] bg-[var(--paper-2)] p-6 flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[12px] font-semibold text-[rgba(27,29,31,0.4)]">{item.id}</span>
                      <span className="rounded-full border border-[rgba(61,74,66,0.3)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--slate)] bg-[rgba(255,255,255,0.6)]">
                        {item.sector}
                      </span>
                    </div>
                    <h3 className="font-serif text-[24px] font-medium text-[var(--ink)] mb-2">
                      {item.name}
                    </h3>
                    <p className="text-[14px] leading-[1.55] text-[rgba(27,29,31,0.68)]">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-8 flex items-center justify-between border-t border-[rgba(27,29,31,0.1)] pt-4">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[rgba(27,29,31,0.45)]">{item.est}</span>
                    <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--brass)] font-semibold flex items-center gap-1">
                      Explore <span className="text-[14px]">→</span>
                    </span>
                  </div>
                </div>
              ))}
              <div className="w-2 shrink-0" />
            </div>

            {/* Mobile Swipe Hint */}
            <div className="mt-3 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] text-[rgba(27,29,31,0.45)] px-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brass)] animate-pulse" />
                Deslize para ver a carteira
              </span>
              <span>1 / {portfolioItems.length}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="values" className="bg-[var(--paper-2)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
                What We Won’t Compromise On
              </p>
              <h2 className="mt-3 max-w-xl font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-medium">
                Four principles, applied everywhere.
              </h2>
            </div>
            <p className="max-w-[360px] text-[15px] leading-[1.6] text-[rgba(27,29,31,0.65)]">
              Not a poster on the wall — the actual filter we use to decide what to buy, who to hire, and how to lead.
            </p>
          </AnimatedSection>

          <div className="grid gap-8 border-y border-[rgba(27,29,31,0.14)] py-4 md:grid-cols-2 xl:grid-cols-4">
            {values.map((value, index) => (
              <AnimatedSection key={value.title} className="group cursor-default">
                <span className="mb-4 block font-serif text-[15px] italic text-[var(--brass)]">{index + 1}.</span>
                <h3 className="mb-3 font-serif text-[20px] font-medium transition-colors duration-500 group-hover:text-[var(--brass)]">{value.title}</h3>
                <p className="text-[13.5px] leading-[1.6] text-[rgba(27,29,31,0.62)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.85)]">{value.copy}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="operate" className="px-6 py-24 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <AnimatedSection>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
              How We Operate
            </p>
            <h2 className="mt-3 font-serif text-[clamp(1.6rem,2.8vw,2.25rem)] font-medium leading-[1.2]">
              Independent operators. Shared backbone.
            </h2>
            <p className="mt-5 max-w-[400px] text-[15px] leading-[1.7] text-[rgba(27,29,31,0.65)]">
              We stay out of the way on the things founders do best, and step in on the things that are painful to build alone.
            </p>
          </AnimatedSection>

          <div className="border-t border-[rgba(27,29,31,0.14)]">
            {operatingPrinciples.map((item) => (
              <AnimatedSection key={item.title} className="group grid gap-4 border-b border-[rgba(27,29,31,0.14)] py-6 md:grid-cols-[150px_minmax(0,1fr)] cursor-default">
                <h4 className="font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--brass)] transition-colors duration-500 group-hover:opacity-80">{item.title}</h4>
                <p className="text-[14.5px] leading-[1.6] text-[rgba(27,29,31,0.68)] transition-colors duration-500 group-hover:text-[rgba(27,29,31,0.95)]">{item.copy}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="leadership" className="bg-[var(--paper-2)] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
              Leadership
            </p>
            <div className="mt-8 grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
              <div className="relative h-[270px] w-[220px] shrink-0 overflow-hidden bg-[var(--ink)] rounded-sm">
                <Image 
                  src="/brand/TannerMilne.png" 
                  alt="Tanner Milne"
                  fill
                  className="object-cover object-center object-top grayscale hover:grayscale-40 transition-all duration-400 contrast-105 rounded-sm"
                />
              </div>
              <div>
                <div className="font-serif text-[30px] font-medium">Tanner Milne</div>
                <div className="mt-2 font-mono text-[12px] uppercase tracking-[0.05em] text-[var(--brass)]">
                  Founder, TAGR Holdings · MBA, CCIM, SIOR
                </div>
                <blockquote className="mt-6 max-w-[560px] border-l-2 border-[var(--brass)] pl-6 font-serif text-[22px] italic leading-[1.5] text-[var(--ink)]">
                  “I’d rather own four businesses I understand deeply than forty I only skim.”
                </blockquote>
                <p className="mt-6 max-w-[560px] text-[15px] leading-[1.7] text-[rgba(27,29,31,0.68)]">
                  Background in commercial real estate and operating businesses, the thinking behind starting TAGR, and what he looks for in a company before acquiring it. Keep this in first person; it’s the most human part of the site.
                </p>
                <Link href="https://tannermilne.co" target="_blank" className="mt-5 inline-block border-b border-[var(--brass)] pb-1 font-mono text-[12px] uppercase tracking-[0.04em]">
                  Read Tanner’s personal story on tannermilne.co →
                </Link>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section id="contact" className="bg-[var(--ink)] px-6 py-24 text-[var(--cream)] lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <AnimatedSection>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C7A667]">
              Get In Touch
            </p>
            <h2 className="mt-4 max-w-[500px] font-serif text-[clamp(1.9rem,3.2vw,2.75rem)] font-medium leading-[1.15]">
              Own a business you’re proud of? Let’s talk.
            </h2>
            <p className="mt-5 max-w-[400px] text-[15px] leading-[1.65] text-[rgba(245,242,236,0.7)]">
              Whether you’re an operator thinking about your next chapter, or a business owner exploring a sale, we’d like to hear from you.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <ContactForm />
          </AnimatedSection>
        </div>
      </section>

      <footer className="border-t border-[rgba(245,242,236,0.16)] bg-[var(--ink)] px-6 py-8 text-[12.5px] text-[rgba(245,242,236,0.5)] lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 TAGR HOLDINGS</div>
          <div className="flex flex-wrap gap-6">
            <Link href="#portfolio" className="transition hover:text-[var(--cream)]">
              Portfolio
            </Link>
            <Link href="#values" className="transition hover:text-[var(--cream)]">
              Values
            </Link>
            <Link href="https://tannermilne.co" target="_blank" className="transition hover:text-[var(--cream)]">
              Tanner Milne
            </Link>
          </div>
        </div>
      </footer>
      <ScrollToTop />
    </div>
  );
}

export default LandingPage;
