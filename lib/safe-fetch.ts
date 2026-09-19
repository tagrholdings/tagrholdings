import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Fetching a URL that came from outside (a pasted link, an email's confirmation
 * link) is an SSRF risk: a hostile value could point the server at localhost, a
 * cloud metadata endpoint or a private network. Everything here refuses non-public
 * hosts — checked on the first URL AND on every redirect hop, since a public URL
 * can redirect to an internal one.
 *
 * Known gap, accepted: the hostname is resolved here and again by `fetch`, so a
 * DNS-rebinding attacker who controls a domain could answer differently the
 * second time. The requests are GET-only, short-lived, and the response is only
 * ever read as text — it is never forwarded to the caller as a proxy.
 */

function isPublicIpv4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false; // link-local, incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a >= 224) return false; // multicast + reserved
  return true;
}

export function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPublicIpv4(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return false;
    // IPv4-mapped (::ffff:1.2.3.4): judge the embedded IPv4 address.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIpv4(mapped[1]);
    if (/^f[cd]/.test(lower)) return false; // unique-local fc00::/7
    if (/^fe[89ab]/.test(lower)) return false; // link-local fe80::/10
    return true;
  }
  return false;
}

export async function isPublicHttpUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return isPublicIp(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => isPublicIp(a.address));
  } catch {
    return false;
  }
}

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  contentType: string;
  /** Body as text, truncated to `maxBytes`. */
  text: string;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
}

const DEFAULT_USER_AGENT = "TagrLeadEngine/1.0 (+https://www.tagrholdings.com; business research)";

/**
 * GET with SSRF protection. Returns null when the URL (or a redirect hop) is not
 * a public http(s) address, or the request failed/timed out — callers treat both
 * as "couldn't fetch". A non-2xx answer IS returned (status is in the result).
 */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult | null> {
  const { timeoutMs = 10_000, maxBytes = 600_000, maxRedirects = 5, userAgent = DEFAULT_USER_AGENT } = options;
  let current = rawUrl;

  try {
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (!(await isPublicHttpUrl(current))) return null;
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }

      return {
        status: response.status,
        finalUrl: current,
        contentType: response.headers.get("content-type") ?? "",
        text: await readCapped(response, maxBytes),
      };
    }
    return null; // too many redirects
  } catch {
    return null;
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks).subarray(0, maxBytes));
}
