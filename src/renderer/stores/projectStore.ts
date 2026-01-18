import { create } from 'zustand'
import type { Project, ManuscriptItem, Sheet, UserTypographyOverrides } from '@shared/types/project'
import { useEditorStore } from './editorStore'

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

interface ProjectState {
  project: Project | null
  projectPath: string | null
  isLoading: boolean
  isDirty: boolean
  activeDocumentId: string | null
  activeSheetId: string | null  // Currently edited sheet (null = editing manuscript)

  // Actions
  setProject: (project: Project, path: string) => void
  updateProject: (updates: Partial<Project>) => void
  setActiveDocument: (id: string | null) => void
  setActiveSheet: (id: string | null) => void
  setDirty: (dirty: boolean) => void

  // Manuscript actions
  addManuscriptItem: (item: ManuscriptItem, parentId?: string) => void
  updateManuscriptItem: (id: string, updates: Partial<ManuscriptItem>) => void
  deleteManuscriptItem: (id: string) => void
  duplicateManuscriptItem: (id: string) => void
  reorderManuscriptItems: (items: ManuscriptItem[]) => void

  // Sheet actions
  addSheet: (sheet: Sheet) => void
  updateSheet: (id: string, updates: Partial<Sheet>) => void
  deleteSheet: (id: string) => void
  duplicateSheet: (id: string) => void

  // Typography overrides
  updateTypographyOverrides: (overrides: UserTypographyOverrides) => void

  // File operations
  createNewProject: (name: string, author: string, template: string, path?: string) => Promise<void>
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  loadLastProject: () => Promise<void>
}

const createEmptyProject = (name: string, author: string, template: string): Project => ({
  meta: {
    id: crypto.randomUUID(),
    name,
    author,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template
  },
  manuscript: {
    items: [
      {
        id: crypto.randomUUID(),
        type: 'chapter',
        title: 'Chapitre 1',
        status: 'draft',
        wordCount: 0,
        children: []
      }
    ]
  },
  sheets: {
    characters: [],
    locations: [],
    plots: [],
    notes: []
  },
  stats: {
    sessions: [],
    dailyStats: [],
    goals: [
      { type: 'daily', target: 1000, current: 0 },
      { type: 'project', target: 80000, current: 0 }
    ],
    totalWords: 0,
    streak: { current: 0, longest: 0, lastWritingDate: '' },
    manuscriptMode: 'drafting'
  }
})

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  projectPath: null,
  isLoading: false,
  isDirty: false,
  activeDocumentId: null,
  activeSheetId: null,

  setProject: (project, path) => {
    set({ project, projectPath: path, isDirty: false, activeSheetId: null })
    localStorage.setItem('lastProjectPath', path)
  },

  updateProject: (updates) => {
    const { project } = get()
    if (!project) return
    set({
      project: { ...project, ...updates },
      isDirty: true
    })
  },

  setActiveDocument: (id) => set({ activeDocumentId: id, activeSheetId: null }),

  setActiveSheet: (id) => set({ activeSheetId: id }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  addManuscriptItem: (item, parentId) => {
    const { project } = get()
    if (!project) return

    const addToItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      if (!parentId) {
        return [...items, item]
      }
      return items.map(i => {
        if (i.id === parentId) {
          return { ...i, children: [...(i.children || []), item] }
        }
        if (i.children) {
          return { ...i, children: addToItems(i.children) }
        }
        return i
      })
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: addToItems(project.manuscript.items)
        }
      },
      isDirty: true
    })
  },

  updateManuscriptItem: (id, updates) => {
    const { project } = get()
    if (!project) return

    const updateItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      return items.map(i => {
        if (i.id === id) {
          return { ...i, ...updates }
        }
        if (i.children) {
          return { ...i, children: updateItems(i.children) }
        }
        return i
      })
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: updateItems(project.manuscript.items)
        }
      },
      isDirty: true
    })
  },

  deleteManuscriptItem: (id) => {
    const { project } = get()
    if (!project) return

    const removeFromItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      return items
        .filter(i => i.id !== id)
        .map(i => {
          if (i.children) {
            return { ...i, children: removeFromItems(i.children) }
          }
          return i
        })
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: removeFromItems(project.manuscript.items)
        }
      },
      isDirty: true
    })
  },

  duplicateManuscriptItem: (id) => {
    const { project } = get()
    if (!project) return

    // Deep clone function for manuscript items
    const cloneItem = (item: ManuscriptItem): ManuscriptItem => ({
      ...item,
      id: crypto.randomUUID(),
      title: `${item.title} (copie)`,
      children: item.children ? item.children.map(cloneItem) : undefined
    })

    // Find and duplicate item
    const duplicateInItems = (items: ManuscriptItem[]): ManuscriptItem[] => {
      const result: ManuscriptItem[] = []
      for (const item of items) {
        result.push(item)
        if (item.id === id) {
          result.push(cloneItem(item))
        } else if (item.children) {
          // Check if item to duplicate is in children
          const newChildren = duplicateInItems(item.children)
          if (newChildren.length !== item.children.length) {
            result[result.length - 1] = { ...item, children: newChildren }
          }
        }
      }
      return result
    }

    set({
      project: {
        ...project,
        manuscript: {
          items: duplicateInItems(project.manuscript.items)
        }
      },
      isDirty: true
    })
  },

  reorderManuscriptItems: (items) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        manuscript: { items }
      },
      isDirty: true
    })
  },

  addSheet: (sheet) => {
    const { project } = get()
    if (!project) return

    const sheetType = sheet.type as keyof typeof project.sheets
    set({
      project: {
        ...project,
        sheets: {
          ...project.sheets,
          [sheetType + 's']: [...project.sheets[sheetType + 's' as keyof typeof project.sheets], sheet]
        }
      },
      isDirty: true
    })
  },

  updateSheet: (id, updates) => {
    const { project } = get()
    if (!project) return

    const updateSheets = <T extends Sheet>(sheets: T[]): T[] => {
      return sheets.map(s => s.id === id ? { ...s, ...updates } as T : s)
    }

    set({
      project: {
        ...project,
        sheets: {
          characters: updateSheets(project.sheets.characters),
          locations: updateSheets(project.sheets.locations),
          plots: updateSheets(project.sheets.plots),
          notes: updateSheets(project.sheets.notes)
        }
      },
      isDirty: true
    })
  },

  deleteSheet: (id) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        sheets: {
          characters: project.sheets.characters.filter(s => s.id !== id),
          locations: project.sheets.locations.filter(s => s.id !== id),
          plots: project.sheets.plots.filter(s => s.id !== id),
          notes: project.sheets.notes.filter(s => s.id !== id)
        }
      },
      isDirty: true
    })
  },

  duplicateSheet: (id) => {
    const { project, addSheet, setActiveSheet } = get()
    if (!project) return

    // Find the sheet to duplicate
    const allSheets: Sheet[] = [
      ...project.sheets.characters,
      ...project.sheets.locations,
      ...project.sheets.plots,
      ...project.sheets.notes
    ]
    const sheet = allSheets.find(s => s.id === id)
    if (!sheet) return

    const now = new Date().toISOString()
    const newSheet: Sheet = {
      ...sheet,
      id: crypto.randomUUID(),
      name: `${sheet.name} (copie)`,
      createdAt: now,
      updatedAt: now
    }

    addSheet(newSheet)
    setActiveSheet(newSheet.id)
  },

  updateTypographyOverrides: (overrides) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        meta: {
          ...project.meta,
          typographyOverrides: Object.keys(overrides).length > 0 ? overrides : undefined
        }
      },
      isDirty: true
    })
  },

  createNewProject: async (name, author, template, providedPath?) => {
    set({ isLoading: true })
    try {
      const project = createEmptyProject(name, author, template)

      // Browser mode: use localStorage
      if (!isElectron) {
        const projectPath = `browser://${project.meta.id}`
        localStorage.setItem(`palimpseste_project_${project.meta.id}`, JSON.stringify(project))
        localStorage.setItem('palimpseste_lastProject', project.meta.id)

        set({
          project,
          projectPath,
          isLoading: false,
          isDirty: false,
          activeDocumentId: project.manuscript.items[0]?.id || null
        })
        return
      }

      // Electron mode: use file system
      let filePath = providedPath

      // If no path provided, ask the user
      if (!filePath) {
        const result = await window.electronAPI.saveProject()
        if (result.canceled || !result.filePath) {
          set({ isLoading: false })
          return
        }
        filePath = result.filePath
      }

      const projectPath = filePath.endsWith('.palim')
        ? filePath
        : `${filePath}.palim`

      // Create project directory structure
      await window.electronAPI.createDirectory(projectPath)
      await window.electronAPI.createDirectory(`${projectPath}/manuscript/documents`)
      await window.electronAPI.createDirectory(`${projectPath}/sheets/characters`)
      await window.electronAPI.createDirectory(`${projectPath}/sheets/locations`)
      await window.electronAPI.createDirectory(`${projectPath}/sheets/plots`)
      await window.electronAPI.createDirectory(`${projectPath}/sheets/custom`)
      await window.electronAPI.createDirectory(`${projectPath}/stats`)
      await window.electronAPI.createDirectory(`${projectPath}/snapshots`)
      await window.electronAPI.createDirectory(`${projectPath}/trash`)

      // Write project files
      await window.electronAPI.writeFile(
        `${projectPath}/project.json`,
        JSON.stringify(project.meta, null, 2)
      )
      await window.electronAPI.writeFile(
        `${projectPath}/manuscript/structure.json`,
        JSON.stringify(project.manuscript, null, 2)
      )
      await window.electronAPI.writeFile(
        `${projectPath}/stats/sessions.json`,
        JSON.stringify(project.stats.sessions, null, 2)
      )
      await window.electronAPI.writeFile(
        `${projectPath}/stats/goals.json`,
        JSON.stringify(project.stats.goals, null, 2)
      )

      set({
        project,
        projectPath,
        isLoading: false,
        isDirty: false,
        activeDocumentId: project.manuscript.items[0]?.id || null
      })
      localStorage.setItem('lastProjectPath', projectPath)
    } catch (error) {
      console.error('Failed to create project:', error)
      set({ isLoading: false })
    }
  },

  openProject: async () => {
    // Browser mode: not supported, show alert
    if (!isElectron) {
      alert('Ouvrir un projet n\'est pas supporté en mode navigateur. Utilisez Electron.')
      return
    }

    set({ isLoading: true })
    try {
      const result = await window.electronAPI.openProject()
      if (result.canceled || result.filePaths.length === 0) {
        set({ isLoading: false })
        return
      }

      const projectPath = result.filePaths[0]

      // Read project files
      const metaResult = await window.electronAPI.readFile(`${projectPath}/project.json`)
      const structureResult = await window.electronAPI.readFile(`${projectPath}/manuscript/structure.json`)
      const sessionsResult = await window.electronAPI.readFile(`${projectPath}/stats/sessions.json`)
      const goalsResult = await window.electronAPI.readFile(`${projectPath}/stats/goals.json`)

      if (!metaResult.success || !structureResult.success) {
        throw new Error('Failed to read project files')
      }

      const meta = JSON.parse(metaResult.content!)
      const manuscript = JSON.parse(structureResult.content!)
      const sessions = sessionsResult.success ? JSON.parse(sessionsResult.content!) : []
      const goals = goalsResult.success ? JSON.parse(goalsResult.content!) : []

      const project: Project = {
        meta,
        manuscript,
        sheets: {
          characters: [],
          locations: [],
          plots: [],
          notes: []
        },
        stats: {
          sessions,
          dailyStats: [],
          goals,
          totalWords: 0,
          streak: { current: 0, longest: 0, lastWritingDate: '' },
          manuscriptMode: 'drafting'
        }
      }

      set({
        project,
        projectPath,
        isLoading: false,
        isDirty: false,
        activeDocumentId: manuscript.items[0]?.id || null
      })
      localStorage.setItem('lastProjectPath', projectPath)

      // Load typography overrides into editor store
      useEditorStore.getState().loadUserOverrides(meta.typographyOverrides || {})
    } catch (error) {
      console.error('Failed to open project:', error)
      set({ isLoading: false })
    }
  },

  saveProject: async () => {
    const { project, projectPath } = get()
    if (!project || !projectPath) return

    // Get current typography overrides from editor store
    const typographyOverrides = useEditorStore.getState().userTypographyOverrides
    const hasOverrides = Object.keys(typographyOverrides).length > 0

    set({ isLoading: true })
    try {
      // Browser mode: save to localStorage
      if (!isElectron || projectPath.startsWith('browser://')) {
        const projectId = project.meta.id
        const updatedProject = {
          ...project,
          meta: {
            ...project.meta,
            updatedAt: new Date().toISOString(),
            typographyOverrides: hasOverrides ? typographyOverrides : undefined
          }
        }
        localStorage.setItem(`palimpseste_project_${projectId}`, JSON.stringify(updatedProject))
        set({ project: updatedProject, isLoading: false, isDirty: false })
        return
      }

      // Electron mode - include typography overrides
      const updatedMeta = {
        ...project.meta,
        updatedAt: new Date().toISOString(),
        typographyOverrides: hasOverrides ? typographyOverrides : undefined
      }
      await window.electronAPI.writeFile(
        `${projectPath}/project.json`,
        JSON.stringify(updatedMeta, null, 2)
      )
      await window.electronAPI.writeFile(
        `${projectPath}/manuscript/structure.json`,
        JSON.stringify(project.manuscript, null, 2)
      )
      await window.electronAPI.writeFile(
        `${projectPath}/stats/sessions.json`,
        JSON.stringify(project.stats.sessions, null, 2)
      )
      await window.electronAPI.writeFile(
        `${projectPath}/stats/goals.json`,
        JSON.stringify(project.stats.goals, null, 2)
      )

      set({ isLoading: false, isDirty: false })
    } catch (error) {
      console.error('Failed to save project:', error)
      set({ isLoading: false })
    }
  },

  loadLastProject: async () => {
    // Browser mode: load from localStorage
    if (!isElectron) {
      const lastProjectId = localStorage.getItem('palimpseste_lastProject')
      if (!lastProjectId) return

      const savedProject = localStorage.getItem(`palimpseste_project_${lastProjectId}`)
      if (!savedProject) return

      try {
        const project = JSON.parse(savedProject) as Project
        set({
          project,
          projectPath: `browser://${lastProjectId}`,
          isLoading: false,
          isDirty: false,
          activeDocumentId: project.manuscript.items[0]?.id || null
        })

        // Load typography overrides into editor store
        useEditorStore.getState().loadUserOverrides(project.meta.typographyOverrides || {})
      } catch (error) {
        console.error('Failed to load project from localStorage:', error)
      }
      return
    }

    // Electron mode
    const lastPath = localStorage.getItem('lastProjectPath')
    if (!lastPath) return

    const exists = await window.electronAPI.exists(lastPath)
    if (!exists) {
      localStorage.removeItem('lastProjectPath')
      return
    }

    set({ isLoading: true })
    try {
      const metaResult = await window.electronAPI.readFile(`${lastPath}/project.json`)
      const structureResult = await window.electronAPI.readFile(`${lastPath}/manuscript/structure.json`)
      const sessionsResult = await window.electronAPI.readFile(`${lastPath}/stats/sessions.json`)
      const goalsResult = await window.electronAPI.readFile(`${lastPath}/stats/goals.json`)

      if (!metaResult.success || !structureResult.success) {
        set({ isLoading: false })
        return
      }

      const meta = JSON.parse(metaResult.content!)
      const manuscript = JSON.parse(structureResult.content!)
      const sessions = sessionsResult.success ? JSON.parse(sessionsResult.content!) : []
      const goals = goalsResult.success ? JSON.parse(goalsResult.content!) : []

      const project: Project = {
        meta,
        manuscript,
        sheets: {
          characters: [],
          locations: [],
          plots: [],
          notes: []
        },
        stats: {
          sessions,
          dailyStats: [],
          goals,
          totalWords: 0,
          streak: { current: 0, longest: 0, lastWritingDate: '' },
          manuscriptMode: 'drafting'
        }
      }

      set({
        project,
        projectPath: lastPath,
        isLoading: false,
        isDirty: false,
        activeDocumentId: manuscript.items[0]?.id || null
      })

      // Load typography overrides into editor store
      useEditorStore.getState().loadUserOverrides(meta.typographyOverrides || {})
    } catch (error) {
      console.error('Failed to load last project:', error)
      set({ isLoading: false })
    }
  }
}))
