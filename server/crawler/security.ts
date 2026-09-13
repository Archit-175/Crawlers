import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class CrawlError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = 'CrawlError';
  }
}
export function normalizeUrl(input: string, base?: string): string {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    throw new CrawlError('INVALID_URL', 'Enter a complete HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new CrawlError('INVALID_URL', 'Only HTTP and HTTPS URLs are supported.');
  if (url.username || url.password)
    throw new CrawlError('UNSAFE_URL', 'URLs containing credentials are not allowed.');
  if (url.port && !['80', '443'].includes(url.port))
    throw new CrawlError('UNSAFE_URL', 'Only standard web ports are allowed.');
  if (url.href.length > 2048) throw new CrawlError('INVALID_URL', 'URL exceeds 2,048 characters.');
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  url.hash = '';
  // Preserve query ordering: sorting can change the meaning of signed URLs.
  return url.href;
}
export function isPublicAddress(value: string): boolean {
  try {
    let address = ipaddr.parse(value.replace(/^\[|\]$/g, ''));
    if (address.kind() === 'ipv6' && (address as ipaddr.IPv6).isIPv4MappedAddress())
      address = (address as ipaddr.IPv6).toIPv4Address();
    return address.range() === 'unicast';
  } catch {
    return false;
  }
}
export type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;
export const defaultResolver: Resolver = (host) => dns.lookup(host, { all: true, verbatim: true });
export async function resolvePublicUrl(input: string, resolver: Resolver = defaultResolver) {
  const url = new URL(normalizeUrl(input));
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    /\.(localhost|local|internal|home|test|invalid)$/.test(host) ||
    (!host.includes('.') && !host.includes(':'))
  ) {
    throw new CrawlError('SSRF_BLOCKED', 'Local and internal hosts are not allowed.');
  }
  const records = ipaddr.isValid(host)
    ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 }]
    : await resolver(host);
  if (!records.length || records.some((record) => !isPublicAddress(record.address))) {
    throw new CrawlError(
      'SSRF_BLOCKED',
      'The host resolves to a private, reserved, or internal address.',
    );
  }
  const selected = records.find((record) => record.family === 4) ?? records[0];
  return { url, address: selected.address, family: selected.family };
}
export function inScope(candidate: string, seed: string, prefix = ''): boolean {
  try {
    const url = new URL(normalizeUrl(candidate));
    const root = new URL(seed);
    return url.hostname === root.hostname && (!prefix || url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}
