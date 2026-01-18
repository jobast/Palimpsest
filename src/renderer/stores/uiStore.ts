import { create } from 'zustand'

type SidebarPanel = 'project' | 'sheets' | 'analysis' | 'pages'

interface UIState {
  sidebarOpen: boolean
  sidebarPanel: SidebarPanel
  statsSidebarOpen: boolean
  rightPanelOpen: boolean
  theme: 'light' | 'dark' | 'system'
  showWordCount: boolean
  focusMode: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarPanel: (panel: SidebarPanel) => void
  toggleStatsSidebar: () => void
  toggleRightPanel: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleWordCount: () => void
  toggleFocusMode: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarPanel: 'project',
  statsSidebarOpen: true,
  rightPanelOpen: false,
  theme: 'light',
  showWordCount: true,
  focusMode: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarPanel: (panel) => set({ sidebarPanel: panel, sidebarOpen: true }),

  toggleStatsSidebar: () => set((state) => ({ statsSidebarOpen: !state.statsSidebarOpen })),

  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setTheme: (theme) => {
    set({ theme })
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  },

  toggleWordCount: () => set((state) => ({ showWordCount: !state.showWordCount })),

  toggleFocusMode: () => set((state) => ({
    focusMode: !state.focusMode,
    sidebarOpen: state.focusMode, // Open sidebar when exiting focus mode
    statsSidebarOpen: state.focusMode, // Open stats sidebar when exiting focus mode
    rightPanelOpen: false
  }))
}))
