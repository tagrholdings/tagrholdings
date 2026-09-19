/**
 * USD for the engine's spend screens. Per-call API costs are fractions of a
 * cent (one AI extraction is ~$0.0003), so amounts under a dollar keep up to
 * 4 decimals instead of rounding to "$0.00" — which would make a real, small
 * spend look like none. Always "en-US"/USD regardless of runtime locale.
 */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return "$0.00";
  const [min, max] = abs < 1 ? [2, 4] : [2, 2];
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
