"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, Btn, Chip, MiniTable, MiniTabs, MockHead, MockWindow, SOURCING_TABS, Sub, Two, type Tone } from "./ui";

/* Every demo here is state in the browser only — nothing is read or saved. */

const check = (done: boolean, onClick: () => void, label: string) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={done}
    aria-label={label}
    onClick={onClick}
    className={cn("flex size-5 shrink-0 items-center justify-center rounded border text-[11px] text-background transition-colors", done ? "border-foreground bg-foreground" : "border-muted-foreground/50 bg-surface")}
  >
    {done ? "✓" : ""}
  </button>
);

const struck = (done: boolean, children: ReactNode) => <span className={cn(done && "text-muted-foreground line-through")}>{children}</span>;

/* ── Sourcing → Review: the Fit filter ── */

const FITS = { match: ["g", "Match"], partial: ["y", "Partial"], miss: ["r", "Miss"], unknown: ["n", "Unknown"] } as const;
type Fit = keyof typeof FITS;

const REVIEW: { name: string; src: string; city: string; area: [Tone, string]; ask: string; rev: string; fit: Fit }[] = [
  { name: "Established Phoenix HVAC Company, 24 yrs", src: "Broker listing · owner retiring", city: "Phoenix", area: ["g", "In area"], ask: "$2.65M", rev: "$2.4M", fit: "match" },
  { name: "Residential HVAC & Heating, Scottsdale", src: "Broker listing", city: "Scottsdale", area: ["g", "In area"], ask: "$3.1M", rev: "$3.4M", fit: "match" },
  { name: "Commercial HVAC Service Contracts, Tempe", src: "Email digest · owner selling", city: "Tempe", area: ["g", "In area"], ask: "$1.85M", rev: "$1.7M", fit: "match" },
  { name: "Turnkey Air Conditioning Business, Chandler", src: "Broker listing · asking over $3.5M", city: "Chandler", area: ["g", "In area"], ask: "$4.2M", rev: "$3.9M", fit: "miss" },
  { name: "Tucson HVAC & Refrigeration Company", src: "Broker listing", city: "Tucson", area: ["y", "Same state"], ask: "$1.4M", rev: "$1.6M", fit: "match" },
  { name: "Flagstaff Mountain Heating Co.", src: "Broker listing · revenue under $1M", city: "Flagstaff", area: ["y", "Region"], ask: "$860K", rev: "$950K", fit: "miss" },
  { name: "Tempe Appliance Repair", src: "Added by hand · “Rachel mentioned this on a call”", city: "Tempe", area: ["g", "In area"], ask: "$380K", rev: "$520K", fit: "partial" },
  { name: "HVAC Company, Details on Request", src: "Broker listing", city: "Phoenix", area: ["n", "Location?"], ask: "—", rev: "—", fit: "unknown" },
  { name: "Rapid Rooter Drain Service", src: "Google Places · (480) 555-0199", city: "Mesa", area: ["g", "In area"], ask: "—", rev: "—", fit: "unknown" },
];

export function ReviewDemo() {
  const [filter, setFilter] = useState<Fit | "all">("all");
  const rows = REVIEW.filter((r) => filter === "all" || r.fit === filter);
  return (
    <MockWindow url="crm.tagrholdings.com/w/tagr-holdings/sourcing" nav="sourcing">
      <MockHead title="Review" sub="Sourcing · 29 new · 6 sources" action={<Btn>+ Add lead</Btn>} />
      <MiniTabs items={SOURCING_TABS} active="Review" />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by fit">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        {(Object.keys(FITS) as Fit[]).map((f) => (
          <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
            {FITS[f][1]}
          </Chip>
        ))}
      </div>
      <MiniTable
        head={["Business", "Location", "Asking", "Revenue", "Fit"]}
        rows={rows.map((r) => [
          <Two key="n" title={r.name} sub={r.src} />,
          <span key="l" className="whitespace-nowrap">{r.city} <Badge tone={r.area[0]}>{r.area[1]}</Badge></span>,
          r.ask,
          r.rev,
          <Badge key="f" tone={FITS[r.fit][0]}>{FITS[r.fit][1]}</Badge>,
        ])}
      />
    </MockWindow>
  );
}

/* ── Sourcing → Emails: an email opens in a panel ── */

const MAIL_LINK = <span className="mx-0.5 inline-flex items-center rounded border border-divider bg-muted px-1.5 text-[11px] font-semibold text-accent-text">pinnaclebb.example ↗</span>;

const EMAILS: { subject: string; from: string; when: string; result: [Tone, string]; body: ReactNode; found: [string, [Tone, string]][] }[] = [
  {
    subject: "New listings this week: Phoenix trades",
    from: "Pinnacle Business Brokers",
    when: "today",
    result: ["g", "4 listings"],
    body: (
      <>
        Here are this week’s new listings in the Phoenix trades {MAIL_LINK}
        <br />1) Commercial HVAC Service Contracts, Tempe — asking $1.85M {MAIL_LINK}
        <br />2) Maricopa Heating & Air, 18 Years — asking $1.15M {MAIL_LINK}
        <br />3) Pest Control Route, 1,200 Customers — asking $640K
        <br />4) Lawn & Pest Combo Business — asking $450K
      </>
    ),
    found: [["Commercial HVAC Service Contracts", ["g", "Match"]], ["Maricopa Heating & Air", ["g", "Match"]], ["Pest Control Route", ["n", "Unknown"]], ["Lawn & Pest Combo", ["n", "Unknown"]]],
  },
  {
    subject: "Alert: 3 new HVAC businesses in AZ",
    from: "AZ Business Market",
    when: "yesterday",
    result: ["g", "3 listings"],
    body: <>Your saved search “HVAC — Arizona” has 3 new matches {MAIL_LINK}<br />Residential HVAC & Heating, Scottsdale · Tucson HVAC & Refrigeration · Turnkey Air Conditioning, Chandler</>,
    found: [["Residential HVAC & Heating", ["g", "Match"]], ["Tucson HVAC & Refrigeration", ["g", "Match"]], ["Turnkey Air Conditioning", ["r", "Miss"]]],
  },
  {
    subject: "Welcome to our buyer list!",
    from: "AZ Business Market",
    when: "14d",
    result: ["n", "No listing found"],
    body: <>Thanks for joining. Here’s what to expect: new deals every Tuesday and Thursday, off-market deals on Wednesdays… {MAIL_LINK}</>,
    found: [],
  },
];

export function EmailsDemo() {
  const [open, setOpen] = useState(0);
  const email = EMAILS[open];
  return (
    <MockWindow url="crm.tagrholdings.com/w/tagr-holdings/sourcing/emails" nav="sourcing">
      <MockHead title="Emails" sub="Sourcing · tagr-holdings-…@leads.tagrholdings.com" />
      <MiniTabs items={SOURCING_TABS} active="Emails" />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ul className="divide-y divide-divider/60 overflow-hidden rounded-lg border border-divider bg-surface text-xs">
          {EMAILS.map((m, i) => (
            <li key={m.subject}>
              <button type="button" onClick={() => setOpen(i)} aria-current={i === open} className={cn("flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left transition-colors", i === open ? "bg-accent/10" : "hover:bg-muted/50")}>
                <Two title={m.subject} sub={`${m.from} · ${m.when}`} />
                <Badge tone={m.result[0]}>{m.result[1]}</Badge>
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs" aria-live="polite">
          <p className="font-serif text-sm font-semibold text-foreground">{email.subject}</p>
          <Sub className="block">From {email.from}</Sub>
          <p className="mt-2 leading-relaxed text-foreground">{email.body}</p>
          <p className="mt-3 text-xs font-semibold text-foreground">Found in this email</p>
          {email.found.length === 0 ? (
            <Sub className="block">No business for sale was recognised (a welcome message). It’s kept as one find so nothing disappears silently.</Sub>
          ) : (
            <MiniTable className="mt-1" minWidth="min-w-0" rows={email.found.map(([name, [tone, label]]) => [name, <Badge key={name} tone={tone}>{label}</Badge>])} />
          )}
        </div>
      </div>
    </MockWindow>
  );
}

/* ── Leads: a board you can move cards on (drag on a computer, tap a card then a stage anywhere) ── */

interface Card {
  id: string;
  title: string;
  sub: string;
  prog?: string;
  hot?: boolean;
}
const STAGES = ["Sourced", "Outreach", "In Discussion", "Offer", "Diligence", "Closed"];
const BOARD: Record<string, Card[]> = {
  Sourced: [
    { id: "c1", title: "Copper State Electric", sub: "Priya Raman" },
    { id: "c2", title: "Rapid Rooter Drain Service", sub: "Google Places find" },
    { id: "c3", title: "Phoenix Pool Service Route", sub: "Shared from phone" },
  ],
  Outreach: [
    { id: "c4", title: "Valley Pest Solutions", sub: "Tom Brandvold", prog: "0/1" },
    { id: "c5", title: "Ironwood Landscaping", sub: "Hank Doyle" },
    { id: "c6", title: "AZ Fire Protection Inc.", sub: "From broker digest" },
  ],
  "In Discussion": [
    { id: "c7", title: "Sonoran Plumbing Co.", sub: "Owner wants to stay 12 mo.", prog: "1/3" },
    { id: "c8", title: "Saguaro Roofing", sub: "Asked for 3 yrs financials" },
  ],
  Offer: [{ id: "c9", title: "Desert Breeze Heating & Air", sub: "3.1× SDE · awaiting counter" }],
  Diligence: [{ id: "c10", title: "Cool Air Mechanical, HVAC", sub: "LOI signed · ~$2.4M rev", prog: "4/8", hot: true }],
  Closed: [{ id: "c11", title: "Mesa Garage Door Pros", sub: "In integration" }],
};

export function LeadsBoardDemo() {
  const [cols, setCols] = useState(BOARD);
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState("Tap a card, then tap the stage to move it to. On a computer you can also drag.");

  function move(cardId: string, to: string) {
    const from = STAGES.find((s) => cols[s].some((c) => c.id === cardId));
    if (!from) return;
    const card = cols[from].find((c) => c.id === cardId)!;
    if (from !== to) {
      setCols((prev) => ({ ...prev, [from]: prev[from].filter((c) => c.id !== cardId), [to]: [...prev[to], card] }));
      setMessage(`Moved “${card.title}” to ${to}.`);
    }
    setPicked(null);
  }

  return (
    <MockWindow url="crm.tagrholdings.com/w/tagr-holdings/leads" nav="leads">
      <MockHead title="Leads" sub="14 deals · board" action={<Btn>+ New lead</Btn>} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STAGES.map((stage) => (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => move(e.dataTransfer.getData("text/plain"), stage)}
            onClick={() => picked && move(picked, stage)}
            className={cn("w-44 shrink-0 rounded-lg bg-kanban-column p-2 transition-colors", picked && "cursor-pointer ring-1 ring-accent/40")}
          >
            <p className="mb-2 flex justify-between px-1 text-[11px] font-semibold text-muted-foreground">
              {stage} <span>{cols[stage].length}</span>
            </p>
            <div className="flex min-h-16 flex-col gap-1.5">
              {cols[stage].map((card) => (
                <button
                  key={card.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", card.id);
                    setPicked(card.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked(picked === card.id ? null : card.id);
                    setMessage(picked === card.id ? "Tap a card, then tap the stage to move it to." : `“${card.title}” selected — now tap the stage to move it to.`);
                  }}
                  className={cn("rounded-lg border bg-surface p-2 text-left text-[11.5px] leading-snug transition-colors", picked === card.id ? "border-accent ring-2 ring-accent/30" : card.hot ? "border-accent/60" : "border-divider")}
                >
                  {card.prog && <span className="float-right font-mono text-[10px] text-muted-foreground">{card.prog}</span>}
                  <span className="block font-semibold text-foreground">{card.title}</span>
                  <span className="text-[10.5px] text-muted-foreground">{card.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">{message}</p>
    </MockWindow>
  );
}

/* ── Activities: tick things off ── */

const TODOS: { id: string; title: string; link: string; due: string; late?: boolean; prio: [Tone, string] }[] = [
  { id: "a1", title: "Call back Janelle: pricing question", link: "Sonoran Plumbing Co.", due: "4 days ago", late: true, prio: ["r", "High"] },
  { id: "a2", title: "Request 3 years of tax returns", link: "Saguaro Roofing", due: "6 days ago", late: true, prio: ["y", "Medium"] },
  { id: "a3", title: "Intro call: Valley Pest Solutions 🔔", link: "Tom Brandvold", due: "Today 11:30", prio: ["y", "Medium"] },
  { id: "a4", title: "LOI review with Sandstone Legal 🔔", link: "Cool Air Mechanical", due: "Today 2:00", prio: ["r", "High"] },
  { id: "a5", title: "Draft the 3rd-truck financing plan", link: "◆ Rock: Get 3rd Truck", due: "Tomorrow", prio: ["y", "Medium"] },
  { id: "a6", title: "Site visit: Cool Air Mechanical shop", link: "Assigned to Jay", due: "In 2 days", prio: ["r", "High"] },
];

export function ActivitiesDemo() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setDone((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
  return (
    <MockWindow url="crm.tagrholdings.com/w/tagr-holdings/activities" nav="activities">
      <MockHead title="Activities" sub="List" action={<div className="flex gap-1.5"><Chip>Week</Chip><Chip on>List</Chip><Btn>+ New</Btn></div>} />
      <div className="flex flex-wrap gap-1.5"><Chip>All</Chip><Chip>Overdue · 2</Chip><Chip on>Today · 3</Chip><Chip>Next 7 days</Chip><Chip>Done</Chip></div>
      <MiniTable
        head={["", "Activity", "Linked to", "Due", "Priority"]}
        rows={TODOS.map((t) => [
          check(done.has(t.id), () => toggle(t.id), `Mark “${t.title}” ${done.has(t.id) ? "not done" : "done"}`),
          <span key="t" className="font-medium text-foreground">{struck(done.has(t.id), t.title)}</span>,
          <Sub key="l">{t.link}</Sub>,
          <span key="d" className={cn("whitespace-nowrap", t.late && !done.has(t.id) && "text-destructive")}>{t.due}</span>,
          <Badge key="p" tone={done.has(t.id) ? "n" : t.prio[0]}>{done.has(t.id) ? "Done" : t.prio[1]}</Badge>,
        ])}
      />
    </MockWindow>
  );
}

/* ── Scorecard: type a number, the cell turns green or red ── */

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep"];
const SCORE_ROWS: { name: string; goal?: { op: "ge" | "le"; value: number; label: string }; values: string[] }[] = [
  { name: "Monthly Revenue", goal: { op: "ge", value: 13500, label: "≥ $13,500" }, values: ["14,682.50", "19,050.50", "22,766.50", "27,914.50", ""] },
  { name: "Monthly P&L", values: ["14,926.00", "22,991.88", "17,241.27", "22,478.73", ""] },
  { name: "Active Customers", values: ["301", "340", "378", "396", "421"] },
  { name: "Call backs", goal: { op: "le", value: 5, label: "≤ 5 (try it)" }, values: ["", "", "", "", ""] },
  { name: "New Customers", values: ["", "", "", "", ""] },
];

export function ScorecardDemo() {
  const [values, setValues] = useState(() => SCORE_ROWS.map((r) => r.values));
  function state(rowIndex: number, raw: string): "on" | "off" | null {
    const goal = SCORE_ROWS[rowIndex].goal;
    const n = Number(raw.replace(/[$,\s]/g, ""));
    if (!goal || raw.trim() === "" || Number.isNaN(n)) return null;
    return (goal.op === "le" ? n <= goal.value : n >= goal.value) ? "on" : "off";
  }
  return (
    <MockWindow url="crm.tagrholdings.com/w/grounded/traction/scorecard" nav="scorecard" workspace="Grounded Pest Control">
      <MockHead title="Scorecard" sub="Grounded Pest Control · monthly" action={<div className="flex gap-1.5"><Chip>Weekly</Chip><Chip on>Monthly</Chip></div>} />
      <MiniTable
        minWidth="min-w-[40rem]"
        head={["Measurable", "Goal", ...MONTHS]}
        rows={SCORE_ROWS.map((row, r) => [
          <span key="n" className="font-medium text-foreground">{row.name}</span>,
          <Sub key="g" className="whitespace-nowrap">{row.goal?.label ?? "no goal"}</Sub>,
          ...MONTHS.map((month, c) => {
            const s = state(r, values[r][c]);
            return (
              <input
                key={month}
                inputMode="decimal"
                aria-label={`${row.name}, ${month}`}
                placeholder="—"
                value={values[r][c]}
                onChange={(e) => setValues((prev) => prev.map((rowValues, i) => (i === r ? rowValues.map((v, j) => (j === c ? e.target.value : v)) : rowValues)))}
                className={cn("w-20 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-right text-xs tabular-nums outline-none focus:border-accent focus:bg-surface", s === "on" && "bg-green-600/15 text-green-800 dark:text-green-400", s === "off" && "bg-destructive/10 text-destructive")}
              />
            );
          }),
        ])}
      />
      <p className="text-xs text-muted-foreground">
        <b className="text-foreground">What EOS expects:</b> 5–15 numbers, each with one owner and a goal. <span className="text-destructive">7 have no owner · 6 have no goal.</span>
      </p>
    </MockWindow>
  );
}

/* ── Rocks: cycle a status, watch the completion rate ── */

const ROCK_STATES: [string, Tone, string][] = [["on", "y", "On track"], ["off", "r", "Off track"], ["complete", "g", "Complete"], ["dropped", "n", "Dropped"]];
const ROCKS = [
  { title: "Get 3rd Truck", owner: "Jay", todos: "3/3", start: 2 },
  { title: "5 apartment complexes", owner: "Jay", todos: "5/5", start: 2 },
  { title: "July $50K", owner: "Rex", todos: "1/4", start: 1 },
  { title: "500 customers by July", owner: "Tanner", todos: "2/6", start: 1 },
];

export function RocksDemo() {
  const [states, setStates] = useState(ROCKS.map((r) => r.start));
  const complete = states.filter((s) => ROCK_STATES[s][0] === "complete").length;
  const pct = Math.round((complete / ROCKS.length) * 100);
  return (
    <MockWindow url="crm.tagrholdings.com/w/grounded/traction/rocks" nav="rocks" workspace="Grounded Pest Control">
      <MockHead title="Rocks" sub="Grounded Pest Control · Q2 2026" action={<div className="flex gap-1.5"><Chip on>List</Chip><Chip>Board</Chip><Btn>+ New Rock</Btn></div>} />
      <div className="rounded-lg border border-divider bg-surface p-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Done is binary</p>
          <span className="flex-1" />
          <span className={cn("font-serif text-2xl font-semibold", pct >= 80 ? "text-green-800 dark:text-green-400" : "text-foreground")}>{pct}%</span>
          <Sub>target 80%</Sub>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <MiniTable
        minWidth="min-w-[26rem]"
        head={["Rock", "Owner", "To-dos", "Status (tap it)"]}
        rows={ROCKS.map((rock, i) => [
          <span key="t" className="font-medium text-foreground">{rock.title}</span>,
          rock.owner,
          <Sub key="d">{rock.todos}</Sub>,
          <button key="s" type="button" onClick={() => setStates((prev) => prev.map((s, j) => (j === i ? (s + 1) % ROCK_STATES.length : s)))}>
            <Badge tone={ROCK_STATES[states[i]][1]} className="cursor-pointer">{ROCK_STATES[states[i]][2]}</Badge>
          </button>,
        ])}
      />
    </MockWindow>
  );
}

/* ── Issues ── */

const ISSUES = [
  { id: "i1", rank: "1", title: "Home Inspectors is a channel", kind: ["y", "Idea"], owner: "Grafton", open: "2 wks" },
  { id: "i2", rank: "2", title: "Switch over process: WHO?", kind: ["n", "Problem"], owner: "Kody", open: "5 wks", late: true },
  { id: "i3", rank: "3", title: "Family/Friends discount text", kind: ["y", "Idea"], owner: "Rex", open: "1 wk" },
] as const;

export function IssuesDemo() {
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSolved((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
  return (
    <MockWindow url="crm.tagrholdings.com/w/grounded/traction/issues" nav="issues" workspace="Grounded Pest Control">
      <MockHead title="Issues" sub="Grounded Pest Control" action={<Btn>+ New issue</Btn>} />
      <div className="flex gap-1.5"><Chip on>This week (L10)</Chip><Chip>Long term (V/TO)</Chip></div>
      <MiniTable
        minWidth="min-w-[26rem]"
        head={["", "#", "Issue", "Owner", "Open"]}
        rows={[
          ...ISSUES.map((i) => [
            check(solved.has(i.id), () => toggle(i.id), `Mark “${i.title}” ${solved.has(i.id) ? "open" : "solved"}`),
            <Badge key="r" tone="k">{i.rank}</Badge>,
            <span key="t" className="font-medium text-foreground">{struck(solved.has(i.id), i.title)} <Badge tone={i.kind[0]}>{i.kind[1]}</Badge></span>,
            i.owner,
            <span key="o" className={cn("whitespace-nowrap", "late" in i && i.late && "text-destructive")}>{solved.has(i.id) ? "solved" : i.open}</span>,
          ]),
          ["", <Badge key="a" tone="n">·</Badge>, <span key="s" className="text-muted-foreground line-through">Next Quarterly?</span>, <Sub key="o">Tanner</Sub>, <Sub key="d">solved</Sub>],
          ["", <Badge key="a" tone="n">·</Badge>, <span key="s" className="text-muted-foreground line-through">Find more home inspectors</span>, <Sub key="o">Rex</Sub>, <Sub key="d">solved</Sub>],
        ]}
      />
      <div className="grid gap-3 rounded-lg border border-divider bg-surface p-3 text-xs sm:grid-cols-2">
        <div>
          <Sub>Identify (root cause)</Sub>
          <p className="mt-1 rounded-md border border-divider bg-background p-2 text-foreground">Inspectors see every new homeowner first; we have no referral program for them.</p>
        </div>
        <div>
          <Sub>Solve → To-Dos (7 days)</Sub>
          <p className="mt-1 rounded-md border border-divider bg-background p-2 text-foreground">Create a list of home inspectors: Tanner<br />Marketing at inspector/realtor events: Grafton</p>
        </div>
      </div>
    </MockWindow>
  );
}

/* ── L10: an agenda with a real timer ── */

const L10_STEPS: { key: string; label: string; min: number; body: ReactNode }[] = [
  { key: "segue", label: "1 · Segue", min: 5, body: <>Each person shares one personal and one professional best from the past week.<MiniTable className="mt-2" minWidth="min-w-0" rows={[["Tanner", <Sub key="a">Professional: new truck delivered</Sub>], ["Jay", <Sub key="b">Professional: 5th apartment complex signed</Sub>]]} /></> },
  { key: "scorecard", label: "2 · Scorecard", min: 5, body: <>Read each number: on or off. Off goes to Issues; no discussion now.<MiniTable className="mt-2" minWidth="min-w-0" rows={[["Monthly Revenue", "$27,914.50", <Badge key="a" tone="g">On</Badge>], ["Active Customers", "421", <Badge key="b">No goal</Badge>]]} /></> },
  { key: "rocks", label: "3 · Rock Review", min: 5, body: <>Each owner: on track or off track. Off track → Issues with one click.<MiniTable className="mt-2" minWidth="min-w-0" rows={[["Get 3rd Truck · Jay", <Badge key="a" tone="g">Complete</Badge>], ["July $50K · Rex", <Badge key="b" tone="r">Off track</Badge>], ["500 customers · Tanner", <Badge key="c" tone="r">Off track</Badge>]]} /></> },
  { key: "headlines", label: "4 · Headlines", min: 5, body: <>One-line news. Anything that needs talking becomes an issue.<MiniTable className="mt-2" minWidth="min-w-0" rows={[[<Badge key="a">Customer</Badge>, "MR Fall Festival on Oct 16"], [<Badge key="b">Customer</Badge>, "Meeting with Bullseye Mgmt done"]]} /></> },
  { key: "todos", label: "5 · To-Do List", min: 5, body: <>Done or not done. Target ≥ 90%. <b className="text-destructive">Now 24% (4 of 17).</b><MiniTable className="mt-2" minWidth="min-w-0" rows={[["✓ Create a Scorecard · Tanner"], ["✓ Buy new Truck · Tanner"], ["Send Insurance Waiver · Jay"], ["Create a list of Home Inspectors · Tanner"]]} /></> },
  { key: "ids", label: "6 · IDS", min: 60, body: <>Top three, one at a time. Each issue’s own timer turns red after 15 minutes.<MiniTable className="mt-2" minWidth="min-w-0" rows={[[<Badge key="1" tone="k">1</Badge>, "Home Inspectors is a channel"], [<Badge key="2" tone="k">2</Badge>, "Switch over process: WHO?"], [<Badge key="3" tone="k">3</Badge>, "Family/Friends discount text"]]} /></> },
  { key: "conclude", label: "7 · Conclude", min: 5, body: <>Recap new To-Dos; everyone rates 1–10 from their own device. Under 8 → “what would make it a 10?”<MiniTable className="mt-2" minWidth="min-w-0" rows={[["Tanner", "9"], ["Jay", "8"], ["Rex", "9"], [<span key="g">Grafton <Sub>(no login, rated for)</Sub></span>, "—"], [<b key="a">Average</b>, <b key="b">8.7</b>]]} /></> },
];

export function L10Demo() {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const current = L10_STEPS[step];
  const left = current.min * 60 - elapsed;
  const clock = `${left < 0 ? "+" : ""}${String(Math.floor(Math.abs(left) / 60)).padStart(2, "0")}:${String(Math.abs(left) % 60).padStart(2, "0")}`;

  return (
    <MockWindow url="crm.tagrholdings.com/w/grounded/traction/l10" nav="l10" workspace="Grounded Pest Control">
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sidebar px-3 py-2 text-xs text-sidebar-foreground">
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
        <b>L10 in progress</b>
        <span className="text-sidebar-foreground-muted">· 4 of 5 rated</span>
        <span className="flex-1" />
        <span className="flex items-center gap-1">
          <span className="mr-1 text-sidebar-foreground-muted">Your rating</span>
          {[7, 8, 9, 10].map((n) => (
            <span key={n} className={cn("flex size-6 items-center justify-center rounded-md text-[11px]", n === 9 ? "bg-accent font-bold text-ink" : "bg-sidebar-hover")}>{n}</span>
          ))}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible" role="tablist" aria-label="L10 agenda">
          {L10_STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === step}
              onClick={() => { setStep(i); setElapsed(0); setRunning(false); }}
              className={cn("flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs whitespace-nowrap transition-colors", i === step ? "border-foreground bg-foreground text-background" : "border-divider bg-surface text-foreground")}
            >
              {s.label}
              <small className="font-mono opacity-70">{s.min} min</small>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-divider bg-surface p-3">
            <div className="min-w-0 flex-1">
              <Sub>{current.label.slice(4)}</Sub>
              <p className={cn("font-mono text-3xl font-semibold tabular-nums", left < 0 && "text-destructive")} aria-live="off">{clock}</p>
            </div>
            <button type="button" onClick={() => setRunning((r) => !r)}><Btn>{running ? "❚❚ Pause" : "▶ Start"}</Btn></button>
            <button type="button" onClick={() => { setRunning(false); setElapsed(0); }}><Btn ghost>Reset</Btn></button>
          </div>
          <div className="rounded-lg border border-divider bg-surface p-3 text-xs text-muted-foreground">
            <p className="mb-1 text-sm font-semibold text-foreground">{current.label.slice(4)}</p>
            {current.body}
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

/* ── Vision: the guided setup ── */

const SETUP_STEPS: { title: string; what: string; example: string; fields: string[] }[] = [
  { title: "Core values", what: "3 to 7 rules that define who you are and who fits. Each needs 2–3 behaviors you can see, so it can be used to hire, review and fire.", example: "“Own the outcome” — we finish what we start; we don’t pass blame; we raise problems early.", fields: ["Core value", "Behaviors (one per line)"] },
  { title: "Core focus", what: "Why the company exists (purpose) and what it is the best at (niche). Anything outside it is a distraction.", example: "Purpose: help owners of great small businesses retire well. Niche: buying and growing service companies in Arizona.", fields: ["Purpose", "Niche"] },
  { title: "10-year target", what: "One big, long-range goal everyone can rally around — a date, a number and a short picture.", example: "By 2036: $50M in revenue across 10 operating companies.", fields: ["Date", "Revenue", "Picture"] },
  { title: "Marketing strategy", what: "Who your ideal customer is, the three things that make you different, your proven process and your promise.", example: "Target: owners aged 55+ of $2–10M service businesses in AZ. Uniques: we close fast, keep the team, keep the name.", fields: ["Target market", "Three uniques", "Proven process", "Guarantee"] },
  { title: "3-year picture", what: "Where the company is in three years: revenue, profit, people, and a few lines of what it looks like.", example: "$12M revenue, 15% profit, 80 people — 4 companies and a shared back office.", fields: ["Date", "Revenue", "Profit", "What it looks like"] },
  { title: "1-year plan", what: "This year’s numbers and 3–7 goals. Every quarter’s Rocks should move one of these goals.", example: "$5M revenue; goals: close 2 acquisitions, hire a CFO, 750 active customers.", fields: ["Date", "Revenue", "Goals for the year"] },
];

export function SetupDemo() {
  const [at, setAt] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const step = SETUP_STEPS[at];
  return (
    <MockWindow url="crm.tagrholdings.com/w/tagr-holdings/eos/vision" nav="vision">
      <MockHead title="Vision / Traction Organizer" sub={`Guided setup · Step ${at + 1} of ${SETUP_STEPS.length}`} />
      <div className="flex gap-1" aria-hidden>
        {SETUP_STEPS.map((s, i) => (
          <i key={s.title} className={cn("h-1.5 flex-1 rounded-full", i === at ? "bg-accent" : done.has(i) ? "bg-accent/40" : "bg-foreground/10")} />
        ))}
      </div>
      <div className="grid overflow-hidden rounded-lg border border-divider bg-surface md:grid-cols-[2fr_3fr]">
        <div className="space-y-3 border-b border-divider bg-muted/30 p-4 md:border-r md:border-b-0">
          <h4 className="font-serif text-xl font-semibold text-foreground">{step.title}</h4>
          <p className="text-xs leading-relaxed text-foreground">{step.what}</p>
          <p className="rounded-md border border-divider bg-surface p-2.5 text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">Example:</b> {step.example}</p>
          <ol className="hidden flex-col gap-0.5 md:flex">
            {SETUP_STEPS.map((s, i) => (
              <li key={s.title}>
                <button type="button" onClick={() => setAt(i)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs", i === at ? "bg-accent/15 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted")}>
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px]", done.has(i) ? "bg-accent text-ink" : "border border-divider")}>{done.has(i) ? "✓" : i + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {step.fields.map((f) => (
            <div key={f}>
              <Sub>{f}</Sub>
              <div className="mt-1 h-8 rounded-md border border-divider bg-background" />
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAt((a) => Math.max(0, a - 1))} disabled={at === 0} className="text-xs text-muted-foreground disabled:opacity-40">Back</button>
            <span className="flex-1" />
            <Btn ghost>Finish later</Btn>
            <button type="button" onClick={() => { setDone((d) => new Set(d).add(at)); setAt((a) => Math.min(SETUP_STEPS.length - 1, a + 1)); }}>
              <Btn>{at < SETUP_STEPS.length - 1 ? "Save & continue" : "Save & finish"}</Btn>
            </button>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

/* ── Checkup: the 20 statements, scored live ── */

const CHECKUP = [
  "We have a clear vision in writing that has been properly communicated and is shared by everyone.",
  "Our core values are clear, and we are hiring, reviewing, rewarding, and firing around them.",
  "Our core business is clear, and our systems and processes reflect that.",
  "Our 10-Year Target is clear and has been communicated to everyone.",
  "Our target market is clear, and our sales and marketing efforts are focused on it.",
  "Our differentiators are clear, and all of our sales and marketing efforts communicate them.",
  "We have a proven process for doing business with our customers. It has been named and visually illustrated, and everyone is adhering to it.",
  "All of the people in our organization are the right people.",
  "Our accountability chart is clear, complete, and constantly updated.",
  "Everyone is in the right seat.",
  "Our leadership team is open and honest, and demonstrates a high level of trust.",
  "Everyone has Rocks and is focused on them (3 to 7 priorities per quarter).",
  "Everyone is engaged in regular weekly meetings.",
  "All meetings are on the same day and at the same time each week, have the same printed agenda, start on time, and end on time.",
  "All teams clearly identify, discuss, and solve key issues for the greater good and long term.",
  "Our systems and processes are documented, simplified, and followed by all.",
  "We have a system for receiving regular customer and employee feedback, and we know their level of satisfaction.",
  "A Scorecard for weekly metrics and measurables is in place.",
  "Everyone in the organization has a number.",
  "We have a budget and are monitoring it regularly (e.g., monthly or quarterly).",
];

export function CheckupDemo() {
  const [scores, setScores] = useState([3, 2, 3, 4, 3, 2, 3, 4, 2, 3, 4, 3, 4, 3, 3, 2, 2, 4, 2, 3]);
  const total = scores.reduce((a, b) => a + b, 0);
  const band = total < 40 ? { label: "Needs focus", cls: "text-destructive", bar: "bg-destructive" } : total < 70 ? { label: "Building the foundation", cls: "text-accent-text", bar: "bg-accent" } : { label: "Strong & scalable", cls: "text-green-800 dark:text-green-400", bar: "bg-green-600" };
  return (
    <MockWindow url="crm.tagrholdings.com/w/tagr-holdings/eos/checkup" nav="checkup">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-divider bg-surface p-3">
        <div>
          <Sub>Score</Sub>
          <p className="font-serif text-3xl font-semibold">{total}%</p>
        </div>
        <div className="min-w-40 flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-foreground/10"><div className={cn("h-full rounded-full transition-[width]", band.bar)} style={{ width: `${total}%` }} /></div>
          <p className={cn("mt-1 text-xs", band.cls)}>{band.label} · {total} of 100 points</p>
        </div>
        <div className="text-xs"><Sub className="block">Kickoff → latest</Sub><b>48% → {total}%</b></div>
      </div>
      <ol className="divide-y divide-divider/60 rounded-lg border border-divider bg-surface px-3">
        {CHECKUP.map((q, i) => (
          <li key={q} className="flex flex-col gap-2 py-2.5 text-xs sm:flex-row sm:items-center sm:gap-3">
            <span className="flex-1 leading-snug text-foreground"><Sub className="mr-1.5">{i + 1}</Sub>{q}</span>
            <span className="flex shrink-0 gap-1" role="group" aria-label={`Score for statement ${i + 1}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={scores[i] === n} onClick={() => setScores((prev) => prev.map((s, j) => (j === i ? n : s)))} className={cn("size-8 rounded-md border text-xs transition-colors sm:size-6", scores[i] === n ? "border-foreground bg-foreground text-background" : "border-divider bg-surface text-muted-foreground")}>{n}</button>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </MockWindow>
  );
}


