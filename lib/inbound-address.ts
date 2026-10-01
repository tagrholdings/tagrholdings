/**
 * A workspace's leads-inbox address: `<inbound_local_part>@<INBOUND_EMAIL_DOMAIN>`. Every workspace has its own, so an
 * email's recipient says which workspace it belongs to (see the resend-inbound webhook). The domain is the Resend
 * receiving domain (catch-all), shared by all workspaces. Null while INBOUND_EMAIL_DOMAIN isn't configured.
 */
export function inboundDomain(): string | null {
  return process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase() || null;
}

export function inboundAddressFor(inboundLocalPart: string): string | null {
  const domain = inboundDomain();
  return domain ? `${inboundLocalPart}@${domain}` : null;
}

/** The local part of `to` when it is an address at our inbound domain; null for any other recipient. */
export function inboundLocalPartOf(address: string): string | null {
  const domain = inboundDomain();
  if (!domain) return null;
  const match = address.trim().toLowerCase().match(/<([^>]+)>/);
  const bare = (match ? match[1] : address.trim().toLowerCase()).trim();
  const at = bare.lastIndexOf("@");
  if (at <= 0 || bare.slice(at + 1) !== domain) return null;
  return bare.slice(0, at);
}
