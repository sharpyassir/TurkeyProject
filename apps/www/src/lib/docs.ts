import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

export interface Doc { slug: string; title: string; description: string; section: string; order: number; html: string; headings: { id: string; text: string }[] }

const DIR = join(process.cwd(), 'content/docs');
export const SECTIONS = ['Start here', 'Guides', 'Reference'];

function parse(slug: string, raw: string): Doc {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta: Record<string, string> = {};
  if (m) for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  const body = m ? m[2] : raw;
  const headings: { id: string; text: string }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (depth === 2) headings.push({ id, text });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  const html = marked.parse(body, { renderer, gfm: true }) as string;
  return { slug, title: meta.title ?? slug, description: meta.description ?? '', section: meta.section ?? 'Guides', order: Number(meta.order ?? 99), html, headings };
}

export function allDocs(): Doc[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => parse(f.replace(/\.md$/, ''), readFileSync(join(DIR, f), 'utf8'))).sort((a, b) => a.order - b.order);
}

export function getDoc(slug: string): Doc | undefined {
  try { return parse(slug, readFileSync(join(DIR, `${slug}.md`), 'utf8')); } catch { return undefined; }
}

/** Sidebar entries: markdown pages plus the generated API reference. */
export function nav() {
  const docs = allDocs().map((d) => ({ slug: d.slug, title: d.title, section: d.section }));
  docs.push({ slug: 'api-reference', title: 'API reference', section: 'Reference' });
  return SECTIONS.map((section) => ({ section, items: docs.filter((d) => d.section === section) }));
}
