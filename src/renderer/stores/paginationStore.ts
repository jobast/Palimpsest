import { create } from 'zustand'
import type { PageBreak } from '@/lib/pagination'

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

  // Page breaks with pre-calculated spacer heights
  pageBreaks: PageBreak[]

  // Actions
  setPages: (pages: PageInfo[], pageBreaks: PageBreak[]) => void
  setCurrentPage: (page: number) => void
  setTotalPages: (count: number) => void
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
  pageBreaks: [],

  setPages: (pages, pageBreaks) => set({
    pages,
    totalPages: pages.length,
    pageBreaks,
    lastCalculatedAt: Date.now()
  }),

  setCurrentPage: (page) => {
    const { totalPages } = get()
    set({ currentPage: Math.min(Math.max(1, page), totalPages) })
  },

  setTotalPages: (count) => set({ totalPages: Math.max(1, count) }),

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
    pageBreaks: []
  })
}))
