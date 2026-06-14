import { useEffect } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { FicheNavigator } from './FicheNavigator'
import { FicheEditor } from './FicheEditor'

export function UniversLayout() {
  const ensureLoaded = useWikiStore(s => s.ensureLoaded)
  useEffect(() => { void ensureLoaded() }, [ensureLoaded])

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-64 border-r border-border bg-card overflow-hidden">
        <FicheNavigator />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <FicheEditor />
      </div>
      {/* Volet droit réservé (dashboards/suggestions/recherche — slice 4) */}
      <div className="w-72 border-l border-border bg-card hidden xl:block" />
    </div>
  )
}
