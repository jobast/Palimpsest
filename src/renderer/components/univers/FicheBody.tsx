import ReactMarkdown, { type Components } from 'react-markdown'
import { wikilinksToMarkdown, resolveWikilink, ficheKey, type Fiche } from '@shared/wiki'

/** Renders a fiche body as markdown, with [[wikilinks]] as clickable navigation.
 *  Broken wikilinks (no target fiche) are styled but not clickable. */
export function FicheBody({ body, fiches, onNavigate }: { body: string; fiches: Fiche[]; onNavigate: (key: string) => void }) {
  const md = wikilinksToMarkdown(body)

  const components: Components = {
    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-1">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-0.5">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
    code: ({ children }) => <code className="bg-accent px-1 rounded text-[0.85em]">{children}</code>,
    hr: () => <hr className="my-3 border-border" />,
    a: ({ href, children }) => {
      if (href && href.startsWith('wiki:')) {
        const target = decodeURIComponent(href.slice('wiki:'.length))
        const hit = resolveWikilink(target, fiches)
        if (hit) {
          return (
            <button onClick={() => onNavigate(ficheKey(hit))} className="text-primary hover:underline">
              {children}
            </button>
          )
        }
        return <span className="text-red-500 border-b border-dashed border-red-400" title="Fiche introuvable">{children}</span>
      }
      // Non-wiki link: render as plain text (no external navigation in v1).
      return <span className="underline decoration-dotted">{children}</span>
    }
  }

  return (
    <div className="text-sm text-foreground font-serif">
      <ReactMarkdown components={components}>{md}</ReactMarkdown>
    </div>
  )
}
