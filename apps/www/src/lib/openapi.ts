import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** A flattened view of the OpenAPI document for the static reference page. No runtime dependency. */
export interface Field { name: string; type: string; required: boolean; description?: string; enum?: string[] }
export interface Endpoint { method: string; path: string; summary: string; description?: string; tag: string; auth: boolean; params: Field[]; body: Field[]; responses: { code: string; description: string }[] }

type Any = Record<string, any>;

export function loadOpenApi(): { info: Any; tags: string[]; endpoints: Endpoint[]; errorCodes: string[] } {
  const doc = parse(readFileSync(join(process.cwd(), 'content/openapi.yaml'), 'utf8')) as Any;
  const deref = (o: Any): Any => (o?.$ref ? deref(o.$ref.replace('#/', '').split('/').reduce((acc: Any, k: string) => acc?.[k], doc)) : o);
  const fields = (schema: Any | undefined): Field[] => {
    const s = deref(schema ?? {});
    const req: string[] = s?.required ?? [];
    return Object.entries<Any>(s?.properties ?? {}).map(([name, p]) => {
      const q = deref(p);
      const type = q.type === 'array' ? `${deref(q.items)?.type ?? 'object'}[]` : q.type ?? (q.oneOf ? 'one of' : 'object');
      return { name, type, required: req.includes(name), description: q.description ?? (q.example !== undefined ? `e.g. ${JSON.stringify(q.example)}` : undefined), enum: q.enum };
    });
  };
  const endpoints: Endpoint[] = [];
  for (const [path, item] of Object.entries<Any>(doc.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = item[method];
      if (!op) continue;
      const params: Field[] = [...(item.parameters ?? []), ...(op.parameters ?? [])].map(deref).map((p: Any) => ({ name: `${p.name} (${p.in})`, type: deref(p.schema)?.type ?? 'string', required: !!p.required, description: p.description, enum: deref(p.schema)?.enum }));
      const bodySchema = op.requestBody ? deref(op.requestBody)?.content?.['application/json']?.schema : undefined;
      endpoints.push({
        method: method.toUpperCase(), path: `/v1${path}`, summary: op.summary ?? '', description: op.description, tag: op.tags?.[0] ?? 'other',
        auth: !(Array.isArray(op.security) && op.security.length === 0),
        params, body: fields(bodySchema),
        responses: Object.entries<Any>(op.responses ?? {}).map(([code, r]) => ({ code, description: deref(r)?.description ?? '' })),
      });
    }
  }
  const tags: string[] = (doc.tags ?? []).map((t: Any) => t.name).filter((t: string) => endpoints.some((e) => e.tag === t));
  for (const e of endpoints) if (!tags.includes(e.tag)) tags.push(e.tag);
  const errorCodes: string[] = doc.components?.schemas?.Error?.properties?.error?.properties?.code?.enum ?? [];
  return { info: doc.info, tags, endpoints, errorCodes };
}
