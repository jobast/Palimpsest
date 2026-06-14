import { useEffect, useRef, useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { FicheStructuredFields } from './FicheStructuredFields'
import { backlinks, ficheKey, type Fiche } from '@shared/wiki'

export function FicheEditor() {
  const { getActiveFiche, fiches, saveFiche, setActiveFiche } = useWikiStore()
  const fiche = getActiveFiche()
  const [draft, setDraft] = useState<Fiche | null>(fiche)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const key = fiche ? ficheKey(fiche) : null
  // Latest draft, so the unmount/switch cleanup can flush a pending save.
  const latest = useRef<Fiche | null>(draft)
  latest.current = draft

  // Reload the draft when the active fiche changes.
  useEffect(() => { setDraft(fiche) /* eslint-disable-next-line */ }, [key])

  // Flush pending save on unmount / fiche switch (don't lose the last keystrokes).
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      if (latest.current) void saveFiche(latest.current)
    }
  }, [key, saveFiche])

  if (!fiche || !draft) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Sélectionnez une fiche</div>
  }

  const scheduleSave = (next: Fiche) => {
    setDraft(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveFiche(next) }, 500)
  }

  const back = backlinks(fiche, fiches)

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <input
          className="flex-1 bg-transparent text-lg font-semibold focus:outline-none"
          value={draft.title}
          onChange={e => scheduleSave({ ...draft, title: e.target.value })}
        />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{draft.category}</span>
      </div>

      <FicheStructuredFields fiche={draft} onChange={meta => scheduleSave({ ...draft, meta })} />

      <textarea
        className="flex-1 w-full resize-none bg-background text-foreground p-4 focus:outline-none font-serif leading-relaxed min-h-[12rem]"
        placeholder="Contenu de la fiche (markdown)…"
        value={draft.body}
        onChange={e => scheduleSave({ ...draft, body: e.target.value })}
      />

      {back.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs">
          <div className="text-muted-foreground mb-1">Rétroliens</div>
          <div className="flex flex-wrap gap-2">
            {back.map(b => (
              <button
                key={ficheKey(b)}
                onClick={() => setActiveFiche(ficheKey(b))}
                className="px-2 py-0.5 rounded bg-accent hover:bg-accent/70"
              >
                {b.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
