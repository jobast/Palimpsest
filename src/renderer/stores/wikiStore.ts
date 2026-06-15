import { create } from 'zustand'
import { type Fiche, type WikiCategory, type Suggestion, type IntegrationRecord, ficheKey } from '@shared/wiki'
import { loadFiches, loadSuggestions, loadIntegrations, saveFiche as ioSaveFiche, deleteFiche as ioDeleteFiche, createFiche as ioCreateFiche } from '@/lib/wiki/wikiIO'
import { undoChapterIntegration } from '@/lib/wiki/ingest'
import { useProjectStore } from './projectStore'

interface WikiState {
  fiches: Fiche[]
  suggestions: Suggestion[]
  integrations: Record<string, IntegrationRecord>
  activeFicheKey: string | null
  loadedPath: string | null
  isLoading: boolean

  loadWiki: (projectPath: string) => Promise<void>
  undoChapter: (chapterId: string) => Promise<void>
  refreshSuggestions: () => Promise<void>
  ensureLoaded: () => Promise<void>
  setActiveFiche: (key: string | null) => void
  getActiveFiche: () => Fiche | null
  saveFiche: (fiche: Fiche) => Promise<void>
  createFiche: (category: WikiCategory, title: string) => Promise<void>
  deleteFiche: (fiche: Fiche) => Promise<void>
}

export const useWikiStore = create<WikiState>((set, get) => ({
  fiches: [],
  suggestions: [],
  integrations: {},
  activeFicheKey: null,
  loadedPath: null,
  isLoading: false,

  loadWiki: async (projectPath) => {
    set({ isLoading: true })
    const [fiches, suggestions, integrations] = await Promise.all([
      loadFiches(projectPath), loadSuggestions(projectPath), loadIntegrations(projectPath)
    ])
    set({ fiches, suggestions, integrations, loadedPath: projectPath, isLoading: false })
  },

  undoChapter: async (chapterId) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    await undoChapterIntegration(chapterId)
    const integrations = await loadIntegrations(projectPath)
    set({ integrations })
  },

  refreshSuggestions: async () => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    const suggestions = await loadSuggestions(projectPath)
    set({ suggestions })
  },

  ensureLoaded: async () => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    if (get().loadedPath === projectPath) return
    await get().loadWiki(projectPath)
  },

  setActiveFiche: (key) => set({ activeFicheKey: key }),

  getActiveFiche: () => {
    const { fiches, activeFicheKey } = get()
    return fiches.find(f => ficheKey(f) === activeFicheKey) ?? null
  },

  saveFiche: async (fiche) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    await ioSaveFiche(projectPath, fiche)
    set(state => ({
      fiches: state.fiches.map(f => ficheKey(f) === ficheKey(fiche) ? fiche : f)
    }))
  },

  createFiche: async (category, title) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    const fiche = await ioCreateFiche(projectPath, category, title, '', get().fiches)
    set(state => ({ fiches: [...state.fiches, fiche], activeFicheKey: ficheKey(fiche) }))
  },

  deleteFiche: async (fiche) => {
    const { projectPath } = useProjectStore.getState()
    if (!projectPath) return
    await ioDeleteFiche(projectPath, fiche)
    set(state => ({
      fiches: state.fiches.filter(f => ficheKey(f) !== ficheKey(fiche)),
      activeFicheKey: state.activeFicheKey === ficheKey(fiche) ? null : state.activeFicheKey
    }))
  }
}))
