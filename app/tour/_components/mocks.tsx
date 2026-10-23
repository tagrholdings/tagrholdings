import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, Btn, MiniTable, MiniTabs, MockHead, MockWindow, SOURCING_TABS, Sub, Tile, Two } from "./ui";

/* Static screens. Most are examples (fictional companies from the demo workspace); the Traction and EOS ones use
   Grounded Pest Control's real data, and each section says which is which. */

const T = (path: string) => `crm.tagrholdings.com/w/tagr-holdings/${path}`;
const G = (path: string) => `crm.tagrholdings.com/w/grounded/${path}`;

export function ProfilesMock() {
  return (
    <MockWindow url={T("sourcing/profiles")} nav="sourcing">
      <MockHead title="Search profiles" sub="Sourcing" action={<Btn>+ New profile</Btn>} />
      <MiniTabs items={SOURCING_TABS} active="Search profiles" />
      <MiniTable
        head={["Profile", "Area", "Sources", "Last run", "Status", ""]}
        rows={[
          [<Two key="a" title="HVAC, Phoenix metro (brokers)" sub="HVAC contractors · weekly · cap 100" />, "Phoenix, AZ · 40 mi", <span key="s" className="flex gap-1"><Badge>Places</Badge><Badge>Brokers</Badge></span>, "1 day ago", <Badge key="t" tone="g">Active</Badge>, <Btn key="r" ghost>▶ Run now</Btn>],
          [<Two key="a" title="Plumbing & drain, Mesa" sub="Plumbers · daily · cap 25" />, "Mesa, AZ · state", <span key="s" className="flex gap-1"><Badge>Places</Badge><Badge>Brave</Badge></span>, "today", <Badge key="t" tone="g">Active</Badge>, <Btn key="r" ghost>▶ Run now</Btn>],
          [<Two key="a" title="Pest control, East Valley" sub="Pest control · every 3 days" />, "Gilbert, AZ · 30 mi", <Badge key="s">Places</Badge>, "19 days ago", <Badge key="t">Paused</Badge>, <Btn key="r" ghost>▶ Run now</Btn>],
        ]}
      />
      <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
        <p className="mb-2 text-sm font-semibold text-foreground">Requirements: HVAC, Phoenix metro</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Revenue", "$1M – $5M"], ["Profit", "≥ $250K"], ["Asking price", "≤ $3.5M"], ["Signals", "retiring · owner selling"]].map(([k, v]) => (
            <div key={k}><Sub>{k}</Sub><p className="font-semibold text-foreground">{v}</p></div>
          ))}
        </div>
        <Sub className="mt-2 block">Requirements only <b>mark</b> leads with a fit badge. They never hide or delete one.</Sub>
      </div>
    </MockWindow>
  );
}

export function LeadDetailMock() {
  return (
    <MockWindow url={T("sourcing?lead=established-phoenix-hvac")} nav="sourcing">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><Sub>Broker listing · Desert Biz Brokers · found 2 days ago</Sub><p className="font-serif text-lg font-semibold text-foreground">Established Phoenix HVAC Company, 24 yrs</p></div>
        <div className="flex gap-1.5"><Btn ghost>Dismiss</Btn><Btn>Add to pipeline</Btn></div>
      </div>
      <div className="flex flex-wrap gap-1.5"><Badge tone="g">Match</Badge><Badge tone="g">In area · Phoenix, AZ</Badge><Badge tone="k">HVAC, Phoenix metro</Badge></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <Sub>Summary</Sub>
          <p className="my-2 text-foreground">Residential and light-commercial HVAC service and replacement. 14 employees, strong maintenance-agreement base. Owner retiring and willing to transition.</p>
          <MiniTable minWidth="min-w-0" className="border-0" rows={[["Asking price", <b key="a">$2,650,000</b>], ["Revenue", <b key="b">$2,400,000</b>], ["Profit (SDE)", <b key="c">$610,000</b>], ["Employees", "14"], ["Years in business", "24"], ["Reason for selling", "Owner retiring"]]} />
        </div>
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <Sub>Fit against the buy box</Sub>
          <MiniTable minWidth="min-w-0" className="mt-1 border-0" rows={[["Revenue", <Sub key="a">$2.4M in $1M–$5M</Sub>, <Badge key="p1" tone="g">Pass</Badge>], ["Profit", <Sub key="b">$610K ≥ $250K</Sub>, <Badge key="p2" tone="g">Pass</Badge>], ["Asking price", <Sub key="c">$2.65M ≤ $3.5M</Sub>, <Badge key="p3" tone="g">Pass</Badge>], ["Signals", <Sub key="d">Mentions “retiring”</Sub>, <Badge key="p4" tone="g">Pass</Badge>]]} />
          <p className="mt-3 border-t border-divider pt-2 text-muted-foreground">Any failed check → <Badge tone="r">Miss</Badge> Some passed, some unknown → <Badge tone="y">Partial</Badge> Nothing stated → <Badge>Unknown</Badge></p>
        </div>
      </div>
    </MockWindow>
  );
}

export function AddLeadMock() {
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
      <MockWindow url={T("sourcing")} nav="sourcing">
        <MockHead title="Add lead" />
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <Sub>Link or text of the listing</Sub>
          <p className="mt-1 min-h-20 rounded-md border border-accent bg-background p-2.5 leading-relaxed break-all text-foreground">https://bizlistings.example/phoenix-pool-service-route-290k<br /><Sub>Note: Saw this on a Facebook group.</Sub></p>
          <div className="mt-2 flex justify-end gap-1.5"><Btn ghost>Cancel</Btn><Btn>Add</Btn></div>
        </div>
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <p className="flex flex-wrap items-center gap-2"><Badge tone="g">Added</Badge><b className="text-foreground">Phoenix Pool Service Route</b><Sub>Pool service · Phoenix, AZ</Sub></p>
          <Sub className="mt-1 block">Asking $290K · Revenue $360K · read by AI in ~3 s</Sub>
        </div>
      </MockWindow>
      <div className="mx-auto w-52 rounded-[2rem] border-8 border-foreground bg-surface p-3" aria-hidden>
        <p className="text-center text-[10px] text-muted-foreground">facebook.com/groups/…</p>
        <div className="my-2 h-28 rounded-lg bg-muted" />
        <div className="rounded-xl border border-divider bg-background p-2.5">
          <p className="mb-2 text-[10px] text-muted-foreground">Share to</p>
          <div className="flex justify-around text-center text-[9px]">
            <span><i className="mx-auto mb-1 flex size-9 items-center justify-center rounded-lg bg-accent font-serif text-base font-bold not-italic text-ink">T</i>TAGR CRM</span>
            <span className="text-muted-foreground"><i className="mx-auto mb-1 block size-9 rounded-lg bg-muted" />Messages</span>
            <span className="text-muted-foreground"><i className="mx-auto mb-1 block size-9 rounded-lg bg-muted" />Mail</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListingSitesMock() {
  return (
    <MockWindow url={T("sourcing/listing-sites")} nav="sourcing">
      <MockHead title="Listing sites" sub="Sourcing · 11 brokers" action={<Btn>+ Add site</Btn>} />
      <MiniTabs items={SOURCING_TABS} active="Listing sites" />
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-foreground"><b className="text-destructive">2 sites need you.</b> They turn away automatic visitors. Open them yourself, or sign up for their emails under Email sources.</p>
      <MiniTable
        head={["Site", "Found by", "Listings", "Last read", "Status"]}
        rows={[
          [<Two key="a" title="AZ Business Market" sub="azbusinessmarket.example/listings" />, "Engine", "22", "1d", <Badge key="s" tone="g">OK</Badge>],
          [<Two key="a" title="Desert Biz Brokers" sub="…/businesses-for-sale" />, "Engine", "14", "1d", <Badge key="s" tone="g">OK</Badge>],
          [<Two key="a" title="Pinnacle Business Brokers" sub="…/buy-a-business" />, "Added by us", "9", "1d", <Badge key="s" tone="g">OK</Badge>],
          [<Two key="a" title="Grand Canyon Business Sales" sub="robots.txt asks robots to stay out" />, "Engine", "—", "3d", <Badge key="s" tone="r">Blocked</Badge>],
          [<Two key="a" title="Saguaro Deal Exchange" sub="showed an “are you human?” check" />, "Engine", "—", "3d", <Badge key="s" tone="r">Blocked</Badge>],
          [<Two key="a" title="Arizona Business Association" sub="a member directory, nothing for sale" />, "Engine", "0", "4d", <Badge key="s">No listings</Badge>],
          [<Two key="a" title="Copperline Business Brokers" sub="timed out, retried next run" />, "Engine", "—", "1d", <Badge key="s" tone="y">Error</Badge>],
        ]}
      />
    </MockWindow>
  );
}

export function EmailSourcesMock() {
  return (
    <MockWindow url={T("sourcing/email-sources")} nav="sourcing">
      <MockHead title="Email sources" sub="Sourcing · inbox: tagr-holdings-…@leads.tagrholdings.com" action={<Btn>+ Add site</Btn>} />
      <MiniTabs items={SOURCING_TABS} active="Email sources" />
      <MiniTable
        head={["Site", "Last attempt", "Subscribed"]}
        rows={[
          [<Two key="a" title="Pinnacle Brokers digest" sub="pinnaclebb.example/newsletter" />, "Form submitted", <Badge key="s" tone="g">Subscribed</Badge>],
          [<Two key="a" title="Desert Biz Brokers weekly digest" sub="confirmed automatically" />, "Form submitted", <Badge key="s" tone="g">Subscribed</Badge>],
          [<Two key="a" title="Sun Valley Mergers new listings" sub="waiting for the confirmation email" />, "Submitted 1d ago", <Badge key="s" tone="y">Pending</Badge>],
          [<Two key="a" title="Grand Canyon Business Sales alerts" sub="has a captcha, sign up by hand" />, "Captcha", <Badge key="s" tone="r">Needs you</Badge>],
          [<Two key="a" title="Southwest Biz Advisors private list" sub="asks for an NDA first" />, "Manual", <Badge key="s" tone="r">Needs you</Badge>],
          [<Two key="a" title="Copperline Brokers updates" sub="email field not found on the page" />, "Failed", <Badge key="s">Not yet</Badge>],
        ]}
      />
    </MockWindow>
  );
}

export function SpendMock() {
  return (
    <MockWindow url={T("settings/engine-spend")} nav="settings">
      <MockHead title="Engine spend" sub="Settings · estimates at list price" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Total" value="$0.94" detail="all services" />
        <Tile label="Leads added" value="83" detail="7 runs" />
        <Tile label="Per lead" value="$0.011" detail="average" />
        <Tile label="Failed runs" value="1" detail="Places quota" valueClass="text-destructive" />
      </div>
      <MiniTable
        minWidth="min-w-[22rem]"
        head={["Service", "Calls", "Cost"]}
        rows={[["Google Places · text search", "18", "$0.58"], ["Brave Search", "48", "$0.24"], ["Gemini · extraction", "114", "$0.08"], ["Google Geocoding", "7", "$0.04"], ["Resend · inbound email", "7", "$0.003"]]}
      />
    </MockWindow>
  );
}

export function ProjectsMock() {
  const cols: [string, [string, string?][]][] = [
    ["To do", [["Equipment and vehicle inventory", "Cool Air Mechanical"], ["Customer concentration analysis", "Top 10 customers by revenue"]]],
    ["In progress", [["Quality of earnings review", "CPA engaged; draft due Friday"], ["Lease review (two locations)", "Sandstone Legal"]]],
    ["Waiting on seller", [["Employee roster and licenses", "Seller sending the license list"]]],
    ["Done", [["Insurance and claims history"], ["Lender package", "Term sheet received"]]],
  ];
  return (
    <MockWindow url={T("projects")} nav="projects">
      <MockHead title="Projects" sub="4 active boards" action={<div className="flex gap-1.5"><Btn ghost>Manage</Btn><Btn>+ New item</Btn></div>} />
      <MiniTabs items={["Due diligence, Cool Air", "Financing", "Partnerships & Recruiting", "Internal Initiatives"]} active="Due diligence, Cool Air" />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cols.map(([name, cards]) => (
          <div key={name} className="w-44 shrink-0 rounded-lg bg-kanban-column p-2">
            <p className="mb-2 flex justify-between px-1 text-[11px] font-semibold text-muted-foreground">{name}<span>{cards.length}</span></p>
            <div className="flex flex-col gap-1.5">
              {cards.map(([title, sub]) => (
                <div key={title} className="rounded-lg border border-divider bg-surface p-2 text-[11.5px] leading-snug">
                  <p className="font-semibold text-foreground">{title}</p>
                  {sub && <Sub className="text-[10.5px]">{sub}</Sub>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

export function ContactsMock() {
  const people: [string, string, string, string][] = [
    ["Dale Hutchins", "Cool Air Mechanical", "dale@coolairmechanical.example", "602-555-0114"],
    ["Greg Pruitt", "Desert Breeze Heating & Air", "greg@desertbreezehvac.example", "480-555-0171"],
    ["Rachel Kim", "Pinnacle Business Brokers", "rachel@pinnaclebb.example", "602-555-0190"],
    ["Owen Patel", "Arizona Commerce Lender", "opatel@azcommercelender.example", "602-555-0107"],
    ["Diane Whitaker", "Sandstone Legal Group", "dwhitaker@sandstonelegal.example", "602-555-0128"],
    ["Janelle Ortiz", "Sonoran Plumbing Co.", "janelle@sonoranplumbing.example", "480-555-0188"],
  ];
  return (
    <MockWindow url={T("contacts")} nav="contacts">
      <MockHead title="Contacts" sub="25 people · 19 organizations" action={<div className="flex gap-1.5"><Btn ghost>+ Organization</Btn><Btn>+ New</Btn></div>} />
      <MiniTabs items={["People", "Organizations", "Team"]} active="People" />
      <MiniTable head={["Name", "Organization", "Email", "Phone"]} rows={people.map(([n, o, e, p]) => [<b key="n" className="text-foreground">{n}</b>, o, <Sub key="e">{e}</Sub>, <Sub key="p">{p}</Sub>])} />
    </MockWindow>
  );
}

export function ContactDetailMock() {
  return (
    <MockWindow url={T("contacts/dale-hutchins")} nav="contacts">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-divider bg-surface p-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-sidebar font-serif text-lg text-sidebar-foreground">DH</span>
        <div className="min-w-0 flex-1"><p className="font-serif text-lg font-semibold text-foreground">Dale Hutchins</p><Sub>Cool Air Mechanical · owner</Sub></div>
        <div className="text-xs text-accent-text"><p>dale@coolairmechanical.example</p><p>602-555-0114</p></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs"><p className="mb-1 font-semibold text-foreground">Leads</p><p className="flex items-center justify-between gap-2">Cool Air Mechanical, HVAC <Badge tone="k">Diligence</Badge></p></div>
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs"><p className="mb-1 font-semibold text-foreground">Projects</p><p className="flex items-center justify-between gap-2">Quality of earnings review <Badge tone="y">In progress</Badge></p></div>
      </div>
      <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
        <p className="mb-2 flex items-center justify-between font-semibold text-foreground">Calls, meetings and tasks <Badge>2 done</Badge></p>
        <MiniTable minWidth="min-w-0" className="border-0" rows={[[<b key="a" className="text-foreground">Call Dale about the QoE draft</b>, <span key="b" className="text-destructive">2 days ago</span>], [<b key="c" className="text-foreground">Site visit: Cool Air Mechanical shop</b>, "In 2 days"], [<s key="d" className="text-muted-foreground">Kickoff with Cool Air owner</s>, <Sub key="e">25 days ago</Sub>], [<s key="f" className="text-muted-foreground">Sign the NDA for Cool Air</s>, <Sub key="g">27 days ago</Sub>]]} />
      </div>
    </MockWindow>
  );
}

export function OverviewMock() {
  return (
    <MockWindow url={G("traction")} nav="overview" workspace="Grounded Pest Control">
      <MockHead title="Traction" sub="Grounded Pest Control · this week" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Scorecard" value={<>1 <span className="text-sm text-green-800 dark:text-green-400">on goal</span></>} detail="Revenue $27.9K vs $13.5K goal" />
        <Tile label="Rocks · Q2" value="2/4" detail={<Badge tone="r">2 off track</Badge>} />
        <Tile label="Open issues" value="3" detail="2 solved" />
        <Tile label="L10 To-Dos" value="24%" valueClass="text-destructive" detail="4 of 17 done · target 90%" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <p className="flex items-center justify-between font-semibold text-foreground">Next L10 <Btn>Start meeting</Btn></p>
          <Sub className="my-2 block">Same day, same time · reminder 1 h before (push + email)</Sub>
          <MiniTable minWidth="min-w-0" className="border-0" rows={[[<Badge key="1" tone="k">1</Badge>, "Home Inspectors is a channel", <Sub key="a">Grafton</Sub>], [<Badge key="2" tone="k">2</Badge>, "Switch over process: WHO?", <Sub key="b">Kody</Sub>], [<Badge key="3" tone="k">3</Badge>, "Family/Friends discount text", <Sub key="c">Rex</Sub>]]} />
        </div>
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <p className="font-semibold text-foreground">EOS checks</p>
          <Sub className="mb-2 block">Rules EOS expects that aren’t met yet</Sub>
          <MiniTable minWidth="min-w-0" className="border-0" rows={[[<Badge key="1" tone="r">!</Badge>, "7 measurables have no owner"], [<Badge key="2" tone="r">!</Badge>, "Only 1 of 7 measurables has a goal"], [<Badge key="3" tone="r">!</Badge>, "No Rocks for this quarter yet"], [<Badge key="4" tone="y">!</Badge>, "L10 To-Dos at 24% (target 90%)"], [<Badge key="5" tone="y">!</Badge>, "V/TO has no core values"]]} />
        </div>
      </div>
    </MockWindow>
  );
}

export function HistoryMock() {
  const meetings: [string, [("g" | "r"), string], [string, string][]][] = [
    ["Tue, Oct 13", ["g", "Rating 8.6"], [["To-Dos done", "91%"], ["Issues solved", "3"], ["Rocks off track", "1"], ["Off goal", "0"]]],
    ["Tue, Oct 6", ["g", "Rating 8.1"], [["To-Dos done", "80%"], ["Issues solved", "2"], ["Rocks off track", "2"], ["Off goal", "1"]]],
    ["Tue, Sep 29", ["r", "Rating 7.4"], [["To-Dos done", "62%"], ["Issues solved", "1"], ["Rocks off track", "2"], ["Off goal", "2"]]],
  ];
  return (
    <MockWindow url={G("traction/l10/history")} nav="l10" workspace="Grounded Pest Control">
      <MockHead title="Meeting history" sub="Newest first" />
      {meetings.map(([date, [tone, rating], stats]) => (
        <div key={date} className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <p className="flex items-center justify-between font-semibold text-foreground">{date}<Badge tone={tone}>{rating}</Badge></p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{stats.map(([k, v]) => <div key={k}><Sub>{k}</Sub><p className="font-semibold text-foreground">{v}</p></div>)}</div>
          {tone === "r" && <Sub className="mt-2 block">Under 8 → <i>“To make it a 10: start on time, and keep tangents out of IDS.”</i></Sub>}
        </div>
      ))}
    </MockWindow>
  );
}

export function VtoMock() {
  return (
    <MockWindow url={G("eos/vision")} nav="vision" workspace="Grounded Pest Control">
      <MockHead title="Vision / Traction Organizer" sub="Grounded Pest Control" action={<Btn ghost>Edit V/TO</Btn>} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <p className="label-kicker mb-2 text-accent-text">Vision</p>
          <MiniTable minWidth="min-w-0" className="border-0" rows={[[<Sub key="a">Core values</Sub>, <Dash key="b">to define: 3–7 values</Dash>], [<Sub key="c">Niche</Sub>, <b key="d">Grounded In Trust</b>], [<Sub key="e">10-Year Target</Sub>, <span key="f"><b>$20M</b> · 60–70 techs<Sub className="block">by Jan 30, 2036</Sub></span>], [<Sub key="g">Target market</Sub>, <Dash key="h">to define</Dash>], [<Sub key="i">Proven process</Sub>, <b key="j">Onboarding</b>]]} />
        </div>
        <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
          <p className="label-kicker mb-2 text-accent-text">Traction</p>
          <MiniTable minWidth="min-w-0" className="border-0" rows={[[<Sub key="a">3-Year Picture</Sub>, <span key="b"><b>$3M</b> · by Jan 30, 2029<Sub className="block">8–10 trucks · Office · Team</Sub></span>], [<Sub key="c">1-Year Plan</Sub>, <span key="d"><b>$600K</b> · by Jan 30, 2027</span>], [<Sub key="e">Goals</Sub>, <span key="f" className="space-y-1"><span className="flex justify-between gap-2">4–5 trucks <Badge tone="r">0 Rocks</Badge></span><span className="flex justify-between gap-2">Conex <Badge tone="r">0 Rocks</Badge></span></span>]]} />
        </div>
      </div>
    </MockWindow>
  );
}

function Dash({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-dashed border-foreground/30 px-2 py-0.5 text-[11.5px] text-muted-foreground italic">{children}</span>;
}

function Seat({ title, who, roles, empty }: { title: string; who: string; roles: string[]; empty?: boolean }) {
  return (
    <div className={cn("w-44 rounded-lg border bg-surface p-2.5 text-[11px]", empty ? "border-destructive" : "border-divider")}>
      <p className="font-serif text-sm font-semibold text-foreground">{title}</p>
      <p className={cn("my-0.5 font-semibold", empty && "text-destructive")}>{who}</p>
      <ul className="text-muted-foreground">
        {roles.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

export function PeopleMock() {
  return (
    <MockWindow url={T("eos/people")} nav="people">
      <MockHead title="People" sub="Example company" action={<Btn>+ Add seat</Btn>} />
      <MiniTabs items={["Accountability Chart", "People Analyzer"]} active="Accountability Chart" />
      <div className="flex flex-col items-center gap-3 overflow-x-auto py-1">
        <Seat title="Visionary" who="Owner" roles={["Big relationships", "Culture · 10-year vision"]} />
        <Seat title="Integrator" who="General Manager" roles={["Leads the leadership team", "Runs the L10 · P&L"]} />
        <div className="flex flex-wrap justify-center gap-3">
          <Seat title="Sales & Marketing" who="Sales lead" roles={["Lead generation", "Partner channels"]} />
          <Seat title="Operations" who="Ops manager" roles={["Routes & techs", "Customer service"]} />
          <Seat title="Finance" who="Empty seat" roles={["AR / AP · Budget", "Month-end close"]} empty />
        </div>
      </div>
    </MockWindow>
  );
}

export function ProcessMock() {
  return (
    <MockWindow url={G("eos/process")} nav="process" workspace="Grounded Pest Control">
      <MockHead title="Core processes" sub="By area" action={<Btn>+ Add process</Btn>} />
      <MiniTable
        head={["Process", "Area", "Stage", "Last reviewed"]}
        rows={[
          [<Two key="a" title="Customer onboarding" sub="8 steps" />, "Customer service", <Badge key="s" tone="g">Followed by all</Badge>, "3 wks ago"],
          [<Two key="a" title="Quote to close" sub="6 steps" />, "Sales", <Badge key="s" tone="y">Trained</Badge>, "6 wks ago"],
          [<Two key="a" title="Monthly service route" sub="11 steps" />, "Operations", <Badge key="s" tone="y">Trained</Badge>, "2 wks ago"],
          [<Two key="a" title="Month-end close" sub="7 steps" />, "Finance", <Badge key="s">Documented</Badge>, <span key="r" className="text-destructive">4 months ago · review</span>],
        ]}
      />
      <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
        <p className="font-semibold text-foreground">Customer onboarding · steps</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground"><li>Quote accepted → create the account</li><li>Welcome text + first service date</li><li>Initial treatment, photos in the job</li><li>Follow-up call after 7 days</li><li>Ask for a review / referral</li></ol>
      </div>
    </MockWindow>
  );
}

export function PortfolioMock() {
  return (
    <MockWindow url="crm.tagrholdings.com/admin/portfolio">
      <MockHead title="Portfolio" sub="Every company’s Traction at a glance." />
      <MiniTable
        minWidth="min-w-[44rem]"
        head={["Company", "Scorecard", "Rocks", "Open issues", "To-Dos done", "Last L10", "EOS Checkup"]}
        rows={[
          [<b key="a" className="text-foreground">Grounded Pest Control</b>, <span key="s" className="flex gap-1"><Badge tone="g">1</Badge><Badge tone="r">0</Badge><Sub>6 not entered</Sub></span>, <span key="r">2/4 <Badge tone="r">2 off</Badge></span>, "3", <b key="t" className="text-destructive">24%</b>, <Sub key="l">None yet</Sub>, <Sub key="c">Not taken</Sub>],
          [<span key="a" className="opacity-70"><b className="text-foreground">Mesa Garage Door Pros</b> <Sub>example</Sub></span>, <span key="s" className="flex gap-1"><Badge tone="g">6</Badge><Badge tone="r">2</Badge></span>, <span key="r">3/5 <Badge tone="r">1 off</Badge></span>, "7", <b key="t" className="text-green-800 dark:text-green-400">92%</b>, <span key="l">Oct 13 <Sub>8.6</Sub></span>, <span key="c">41% → <b>58%</b> <span className="text-green-800 dark:text-green-400">+17</span></span>],
          [<span key="a" className="opacity-70"><b className="text-foreground">Menlo CRE</b> <Sub>example</Sub></span>, <span key="s" className="flex gap-1"><Badge tone="g">4</Badge><Badge tone="r">4</Badge></span>, <span key="r">1/4 <Badge tone="r">2 off</Badge></span>, "11", "78%", <span key="l">Oct 12 <Sub>7.6</Sub></span>, <span key="c">36% <Sub>kickoff</Sub></span>],
        ]}
      />
      <MiniTable
        minWidth="min-w-[30rem]"
        head={["Standard numbers · latest", "Monthly revenue", "Active customers", "Aging AR"]}
        rows={[
          [<b key="a" className="text-foreground">Grounded Pest Control</b>, <Badge key="r" tone="g">$27,914.50</Badge>, "421", <Sub key="x">—</Sub>],
          [<span key="a" className="opacity-70"><b className="text-foreground">Mesa Garage Door Pros</b> <Sub>example</Sub></span>, <Badge key="r" tone="r">$88,200</Badge>, "1,140", "$12,400"],
        ]}
      />
    </MockWindow>
  );
}

export function WorkspacesMock() {
  return (
    <MockWindow url="crm.tagrholdings.com/admin">
      <MockHead title="Workspaces" />
      <div className="rounded-lg border border-divider bg-surface p-3 text-xs">
        <p className="font-serif text-base font-semibold text-foreground">Create a workspace</p>
        <Sub className="my-1 block">Each workspace is a separate company: its own people, data and inbox address. Add an email to invite its first admin.</Sub>
        <div className="mt-2 flex flex-wrap gap-2"><span className="min-w-32 flex-1 rounded-md border border-divider bg-background px-2.5 py-1.5 text-muted-foreground">Name</span><span className="min-w-40 flex-1 rounded-md border border-divider bg-background px-2.5 py-1.5 text-muted-foreground">First admin’s email (optional)</span><Btn>Create workspace</Btn></div>
      </div>
      {[["TAGR Holdings", "/w/tagr-holdings · tagr-holdings-…@leads.tagrholdings.com", false], ["Grounded Pest Control", "/w/grounded · grounded-…@leads.tagrholdings.com", false], ["Menlo CRE", "example of what comes next", true]].map(([name, sub, ghost]) => (
        <div key={name as string} className={cn("flex items-center justify-between gap-3 rounded-lg border border-divider bg-surface p-3 text-xs", ghost && "opacity-60")}>
          <Two title={name as string} sub={sub as string} />
          <Sub>Manage ›</Sub>
        </div>
      ))}
    </MockWindow>
  );
}

export function PortalMock() {
  return (
    <MockWindow url="www.tagrholdings.com/portal">
      <div className="rounded-lg bg-sidebar p-6 text-sidebar-foreground">
        <p className="label-kicker text-accent">Portfolio Executive Framework · 2026</p>
        <p className="mt-2 font-serif text-3xl leading-tight font-semibold">Operating <span className="text-accent">Playbook</span></p>
        <p className="mt-2 max-w-md text-xs text-sidebar-foreground-muted">The single source of truth for founders, operators, and partners within the TAGR ecosystem to align on how we build, scale, and operate our companies.</p>
        <div className="mt-4 flex gap-2"><Btn>Explore framework</Btn><span className="rounded-pill border border-sidebar-border px-3.5 py-1.5 text-xs font-semibold">Tools</span></div>
      </div>
    </MockWindow>
  );
}


