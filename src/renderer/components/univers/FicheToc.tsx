import { extractHeadings } from '@shared/wiki'

/** "Sommaire": a clickable table of contents that scrolls to the section. */
export function FicheToc({ body }: { body: string }) {
  const headings = extractHeadings(body)
  if (headings.length < 2) return null  // not worth a TOC for 0-1 sections
  const jump = (slug: string) => document.getElementById(slug)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return (
    <nav className="inline-block border border-border rounded p-3 mb-3 mr-4 text-xs bg-card align-top">
      <div className="font-semibold mb-1">Sommaire</div>
      <ol className="list-decimal pl-4 space-y-0.5">
        {headings.map(h => (
          <li key={h.slug} className={h.level === 3 ? 'ml-3' : ''}>
            <button onClick={() => jump(h.slug)} className="text-primary hover:underline text-left">{h.text}</button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
