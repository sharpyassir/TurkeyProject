/**
 * Nameserver backend. The control plane keeps zones in Postgres and pushes each one whole,
 * so a provider only needs idempotent "make this zone look like this" operations.
 */
export interface RRSet {
  /** Fully qualified, with trailing dot. */
  name: string;
  type: string;
  ttl: number;
  /** Presentation format contents, one per record (hostnames with trailing dots, TXT quoted). */
  records: string[];
}

export interface DnsProvider {
  readonly name: string;
  /** Creates the zone with our NS set if it does not exist. */
  ensureZone(zone: string, nameservers: string[], hostmaster: string): Promise<void>;
  /** Replaces every non SOA/NS-apex rrset so the zone equals `rrsets`. */
  syncZone(zone: string, rrsets: RRSet[]): Promise<void>;
  deleteZone(zone: string): Promise<void>;
  /** Publishes (or removes, when name is null) the PTR for an IPv4 address in its /24 reverse zone. */
  setPtr(ip: string, name: string | null, nameservers: string[], hostmaster: string): Promise<void>;
}

export const DNS_PROVIDER = Symbol('DNS_PROVIDER');

/** in-addr.arpa zone for the /24 that holds the address. */
export function reverseZoneFor(ip: string) {
  const [a, b, c] = ip.split('.');
  return `${c}.${b}.${a}.in-addr.arpa`;
}

export function ptrNameFor(ip: string) {
  const [a, b, c, d] = ip.split('.');
  return `${d}.${c}.${b}.${a}.in-addr.arpa.`;
}

/** In memory provider for development and tests; inspectable through zoneDump(). */
export class FakeDnsProvider implements DnsProvider {
  readonly name = 'fake';
  readonly zones = new Map<string, Map<string, RRSet>>();

  async ensureZone(zone: string, nameservers: string[]) {
    if (!this.zones.has(zone)) {
      const m = new Map<string, RRSet>();
      m.set(`${zone}.|NS`, { name: `${zone}.`, type: 'NS', ttl: 3600, records: nameservers.map((n) => `${n}.`) });
      this.zones.set(zone, m);
    }
  }
  async syncZone(zone: string, rrsets: RRSet[]) {
    const m = this.zones.get(zone);
    if (!m) throw new Error(`zone ${zone} does not exist`);
    for (const k of [...m.keys()]) if (!k.endsWith('|NS') || k !== `${zone}.|NS`) m.delete(k);
    for (const r of rrsets) m.set(`${r.name}|${r.type}`, r);
  }
  async deleteZone(zone: string) {
    this.zones.delete(zone);
  }
  async setPtr(ip: string, name: string | null, nameservers: string[]) {
    const zone = reverseZoneFor(ip);
    await this.ensureZone(zone, nameservers);
    const m = this.zones.get(zone)!;
    const key = `${ptrNameFor(ip)}|PTR`;
    if (name) m.set(key, { name: ptrNameFor(ip), type: 'PTR', ttl: 3600, records: [`${name}.`] });
    else m.delete(key);
  }
  zoneDump(zone: string) {
    return [...(this.zones.get(zone)?.values() ?? [])];
  }
}

/** PowerDNS Authoritative Server through its HTTP API (pdns.conf: api=yes, api-key, webserver). */
export class PowerDnsProvider implements DnsProvider {
  readonly name = 'powerdns';
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  private async call<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T | null }> {
    const r = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/v1/servers/localhost${path}`, {
      method,
      headers: { 'X-API-Key': this.apiKey, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await r.text();
    if (!r.ok && r.status !== 404) throw new Error(`PowerDNS ${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
    return { status: r.status, json: text ? (JSON.parse(text) as T) : null };
  }

  async ensureZone(zone: string, nameservers: string[], hostmaster: string) {
    const id = `${zone}.`;
    const existing = await this.call('GET', `/zones/${encodeURIComponent(id)}`);
    if (existing.status === 200) return;
    await this.call('POST', '/zones', {
      name: id,
      kind: 'Native',
      nameservers: nameservers.map((n) => `${n}.`),
      soa_edit_api: 'INCEPTION-INCREMENT',
      rrsets: [{ name: id, type: 'SOA', ttl: 3600, changetype: 'REPLACE', records: [{ content: `${nameservers[0]}. ${hostmaster.replace('@', '.')}. 1 10800 3600 604800 3600`, disabled: false }] }],
    });
  }

  async syncZone(zone: string, rrsets: RRSet[]) {
    const id = `${zone}.`;
    const current = await this.call<{ rrsets: { name: string; type: string }[] }>('GET', `/zones/${encodeURIComponent(id)}`);
    if (current.status !== 200 || !current.json) throw new Error(`zone ${zone} does not exist on the nameserver`);
    const wanted = new Set(rrsets.map((r) => `${r.name}|${r.type}`));
    const patch: unknown[] = rrsets.map((r) => ({ name: r.name, type: r.type, ttl: r.ttl, changetype: 'REPLACE', records: r.records.map((content) => ({ content, disabled: false })) }));
    for (const r of current.json.rrsets) {
      if (r.type === 'SOA' || (r.type === 'NS' && r.name === id)) continue;
      if (!wanted.has(`${r.name}|${r.type}`)) patch.push({ name: r.name, type: r.type, changetype: 'DELETE' });
    }
    if (patch.length) await this.call('PATCH', `/zones/${encodeURIComponent(id)}`, { rrsets: patch });
  }

  async deleteZone(zone: string) {
    await this.call('DELETE', `/zones/${encodeURIComponent(`${zone}.`)}`);
  }

  async setPtr(ip: string, name: string | null, nameservers: string[], hostmaster: string) {
    const zone = reverseZoneFor(ip);
    await this.ensureZone(zone, nameservers, hostmaster);
    const rrset = name
      ? { name: ptrNameFor(ip), type: 'PTR', ttl: 3600, changetype: 'REPLACE', records: [{ content: `${name}.`, disabled: false }] }
      : { name: ptrNameFor(ip), type: 'PTR', changetype: 'DELETE' };
    await this.call('PATCH', `/zones/${encodeURIComponent(`${zone}.`)}`, { rrsets: [rrset] });
  }
}
