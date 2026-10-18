"use client";

import { useMemo } from "react";
import { CommandSelect } from "@/components/shared/command-select";

/** "GMT-7" for a zone right now. */
function offsetLabel(timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** The zone a due time is entered in — a searchable list of every IANA zone, labelled with its current offset. */
export function TimeZoneSelect({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const options = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    // "UTC" isn't in the list on every engine, but people look for it.
    if (!zones.includes("UTC")) zones.push("UTC");
    return zones.map((zone) => ({ value: zone, label: `${zone.replaceAll("_", " ")} (${offsetLabel(zone)})` }));
  }, []);
  return <CommandSelect value={value} onChange={(v) => v && onChange(v)} options={options} placeholder="Time zone" searchPlaceholder="Search city or zone…" />;
}
