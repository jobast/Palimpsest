import type { Fiche } from './types.js'

export interface WikiLink { target: string; display: string; start: number; end: number }
export interface GraphData { nodes: Array<{ category: string; slug: string; title: string }>; edges: Array<[number, number]> }

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const LINK_RE = /\[\[([^\[\]]+?)\]\]/g

/** Extract [[target]] / [[target|display]] with positions. */
export function extractWikilinks(body: string): WikiLink[] {
  const out: WikiLink[] = []
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(body)) !== null) {
    const inner = m[1]
    const pipe = inner.indexOf('|')
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim()
    const display = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim()
    if (!target) continue
    out.push({ target, display: display || target, start: m.index, end: m.index + m[0].length })
  }
  return out
}

/** Resolve a link target: (1) exact "category/slug", (2) unique slug, (3) title (normalized). */
export function resolveWikilink(target: string, fiches: Fiche[]): Fiche | null {
  const t = target.trim()
  if (t.includes('/')) {
    const [cat, slug] = t.split('/').map(s => s.trim())
    return fiches.find(fch => fch.category === cat && fch.slug === slug) ?? null
  }
  const bySlug = fiches.filter(fch => fch.slug === t)
  if (bySlug.length === 1) return bySlug[0]
  if (bySlug.length > 1) return null
  const nt = normalize(t)
  return fiches.find(fch => normalize(fch.title) === nt) ?? null
}

export function outgoingLinks(fiche: Fiche, fiches: Fiche[]): Fiche[] {
  const seen = new Set<string>()
  const res: Fiche[] = []
  for (const link of extractWikilinks(fiche.body)) {
    const target = resolveWikilink(link.target, fiches)
    if (target && target !== fiche) {
      const key = `${target.category}/${target.slug}`
      if (!seen.has(key)) { seen.add(key); res.push(target) }
    }
  }
  return res
}

export function backlinks(target: Fiche, fiches: Fiche[]): Fiche[] {
  return fiches.filter(fch => fch !== target && outgoingLinks(fch, fiches).includes(target))
}

/** Graph of fiches: nodes = fiches; edges = resolved outgoing links (dedup, no self-loop). */
export function buildGraph(fiches: Fiche[]): GraphData {
  const index = new Map<Fiche, number>()
  fiches.forEach((fch, i) => index.set(fch, i))
  const nodes = fiches.map(fch => ({ category: fch.category, slug: fch.slug, title: fch.title }))
  const edges: Array<[number, number]> = []
  const seen = new Set<string>()
  fiches.forEach((fch, from) => {
    for (const target of outgoingLinks(fch, fiches)) {
      const to = index.get(target)!
      if (to === from) continue
      const key = `${from}-${to}`
      if (!seen.has(key)) { seen.add(key); edges.push([from, to]) }
    }
  })
  return { nodes, edges }
}
