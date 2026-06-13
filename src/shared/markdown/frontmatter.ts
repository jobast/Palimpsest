import { load as yamlLoad, dump as yamlDump } from 'js-yaml'

export interface FrontmatterResult {
  data: Record<string, unknown>
  body: string
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Split a `---`-delimited YAML frontmatter from the markdown body. */
export function parseFrontmatter(md: string): FrontmatterResult {
  const match = md.match(FENCE)
  if (!match) {
    return { data: {}, body: md }
  }
  const body = md.slice(match[0].length)
  try {
    const loaded = yamlLoad(match[1])
    const data = loaded && typeof loaded === 'object' ? (loaded as Record<string, unknown>) : {}
    return { data, body }
  } catch {
    // Corrupt YAML: never throw, never lose the body.
    return { data: {}, body }
  }
}

/** Re-emit a markdown string with a YAML frontmatter block + body. */
export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  const yaml = yamlDump(data, { lineWidth: -1 }).replace(/\n$/, '')
  return `---\n${yaml}\n---\n${body}`
}
