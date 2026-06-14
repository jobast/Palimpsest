import { useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { groupFichesByCategory, ficheKey, WIKI_CATEGORIES, type WikiCategory } from '@shared/wiki'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<WikiCategory, string> = {
  personnages: 'Personnages', lieux: 'Lieux', intrigues: 'Intrigues',
  structure: 'Structure', ecriture: 'Écriture', notes: 'Notes'
}

export function FicheNavigator() {
  const { fiches, activeFicheKey, setActiveFiche, createFiche, deleteFiche } = useWikiStore()
  const [adding, setAdding] = useState<WikiCategory | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const groups = groupFichesByCategory(fiches)

  const submitNew = (category: WikiCategory) => {
    const title = newTitle.trim()
    if (title) void createFiche(category, title)
    setAdding(null); setNewTitle('')
  }

  return (
    <div className="p-2 space-y-3 overflow-auto h-full">
      {WIKI_CATEGORIES.map(category => {
        const group = groups.find(g => g.category === category)
        return (
          <div key={category}>
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{CATEGORY_LABELS[category]}</span>
              <button onClick={() => { setAdding(category); setNewTitle('') }} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Nouvelle fiche">
                <Plus size={13} />
              </button>
            </div>
            {adding === category && (
              <input
                autoFocus
                className="w-full mb-1 bg-background border border-border rounded px-1 text-sm"
                value={newTitle}
                placeholder="Titre…"
                onChange={e => setNewTitle(e.target.value)}
                onBlur={() => submitNew(category)}
                onKeyDown={e => { if (e.key === 'Enter') submitNew(category); if (e.key === 'Escape') { setAdding(null); setNewTitle('') } }}
              />
            )}
            <div className="space-y-0.5">
              {group?.fiches.map(f => {
                const key = ficheKey(f)
                return (
                  <div
                    key={key}
                    className={cn('group flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer',
                      activeFicheKey === key ? 'bg-primary/10 text-primary' : 'hover:bg-accent')}
                    onClick={() => setActiveFiche(key)}
                  >
                    <span className="truncate flex-1">{f.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer « ${f.title} » ?`)) void deleteFiche(f) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
