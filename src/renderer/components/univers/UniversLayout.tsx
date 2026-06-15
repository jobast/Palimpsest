import { useEffect } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { FicheNavigator } from './FicheNavigator'
import { FicheEditor } from './FicheEditor'
import { SuggestionPanel } from './SuggestionPanel'

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
      <div className="w-72 border-l border-border bg-card hidden xl:block overflow-hidden">
        <SuggestionPanel />
      </div>
    </div>
  )
}
