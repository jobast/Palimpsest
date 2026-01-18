import { create } from 'zustand'

export interface PageInfo {
  pageNumber: number
  startPos: number        // ProseMirror document position
  endPos: number
  contentHeight: number   // Actual measured height
}

interface PaginationState {
  // Page data
  pages: PageInfo[]
  totalPages: number
  currentPage: number

  // Calculation state
  isCalculating: boolean
  lastCalculatedAt: number

  // Computed page break positions (ProseMirror positions)
  pageBreakPositions: number[]

  // Actions
  setPages: (pages: PageInfo[]) => void
  setCurrentPage: (page: number) => void
  setIsCalculating: (calculating: boolean) => void
  scrollToPage: (page: number) => void
  reset: () => void
}

export const usePaginationStore = create<PaginationState>((set, get) => ({
  pages: [{ pageNumber: 1, startPos: 0, endPos: 0, contentHeight: 0 }],
  totalPages: 1,
  currentPage: 1,
  isCalculating: false,
  lastCalculatedAt: 0,
  pageBreakPositions: [],

  setPages: (pages) => set({
    pages,
    totalPages: pages.length,
    pageBreakPositions: pages.slice(1).map(p => p.startPos),
    lastCalculatedAt: Date.now()
  }),

  setCurrentPage: (page) => {
    const { totalPages } = get()
    set({ currentPage: Math.min(Math.max(1, page), totalPages) })
  },

  setIsCalculating: (calculating) => set({ isCalculating: calculating }),

  scrollToPage: (page) => {
    // Dispatch custom event for scroll handling in PageView component
    window.dispatchEvent(new CustomEvent('palimpseste:scrollToPage', {
      detail: { page }
    }))
  },

  reset: () => set({
    pages: [{ pageNumber: 1, startPos: 0, endPos: 0, contentHeight: 0 }],
    totalPages: 1,
    currentPage: 1,
    isCalculating: false,
    pageBreakPositions: []
  })
}))
