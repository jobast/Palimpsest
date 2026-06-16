import type { Fiche } from '@shared/wiki'

/** Wikipedia-style infobox: floats right, body text wraps around it. */
export function FicheInfobox({ fiche }: { fiche: Fiche }) {
  const rows: Array<[string, string]> = []
  rows.push(['Type', fiche.type || fiche.category])
  if (fiche.lastUpdated) rows.push(['Mis à jour', fiche.lastUpdated])
  if (fiche.sources && fiche.sources.length) {
    rows.push(['Sources', fiche.sources.map(s => s.replace(/^chapitres\//, '').replace(/\.md$/, '')).join(', ')])
  }
  return (
    <aside className="float-right w-60 ml-4 mb-3 border border-border rounded overflow-hidden bg-card text-xs">
      <div className="px-3 py-2 bg-accent font-semibold text-center">{fiche.title}</div>
      <dl className="p-3 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
