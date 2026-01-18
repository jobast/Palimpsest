export type DocumentStatus = 'draft' | 'revision' | 'final'

// Manuscript mode determines how progress is measured
// - drafting: Net words matter (words added - words deleted)
// - editing: Total changes matter (words added + words deleted)
export type ManuscriptMode = 'drafting' | 'editing'

// User overrides for template typography settings
export interface UserTypographyOverrides {
  fontSize?: string      // e.g., "12pt"
  lineHeight?: number    // e.g., 1.5
  firstLineIndent?: string // e.g., "1cm"
}

export interface ProjectMeta {
  id: string
  name: string
  author: string
  createdAt: string
  updatedAt: string
  template: string
  wordCountGoal?: number
  deadlineDate?: string
  typographyOverrides?: UserTypographyOverrides
}

export interface ManuscriptItem {
  id: string
  type: 'folder' | 'chapter' | 'scene'
  title: string
  synopsis?: string
  status: DocumentStatus
  children?: ManuscriptItem[]
  pov?: string
  location?: string
  wordCount: number
}

export interface ManuscriptStructure {
  items: ManuscriptItem[]
}

export interface SheetBase {
  id: string
  type: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface CharacterSheet extends SheetBase {
  type: 'character'
  role: 'protagonist' | 'antagonist' | 'secondary' | 'minor'
  description: string
  physicalDescription?: string
  backstory?: string
  goals?: string
  flaws?: string
  relationships?: Array<{ characterId: string; relationship: string }>
  notes?: string
  imageUrl?: string
}

export interface LocationSheet extends SheetBase {
  type: 'location'
  description: string
  // Geographic coordinates for map display
  coordinates?: {
    latitude: number
    longitude: number
  }
  mapZoom?: number  // Saved zoom level for this location
  significance?: string
  sensoryDetails?: string
  notes?: string
  imageUrl?: string
}

export interface PlotSheet extends SheetBase {
  type: 'plot'
  plotType: 'main' | 'subplot'
  description: string
  acts?: Array<{ title: string; description: string }>
  keyEvents?: string[]
  notes?: string
}

export interface NoteSheet extends SheetBase {
  type: 'note'
  content: string
  tags?: string[]
}

export type Sheet = CharacterSheet | LocationSheet | PlotSheet | NoteSheet

export interface WritingSession {
  id: string
  date: string
  startTime: string
  endTime: string
  wordsAdded: number
  wordsDeleted: number
  netWords: number
  durationMinutes: number
}

export interface WritingGoal {
  type: 'daily' | 'weekly' | 'monthly' | 'project'
  target: number
  current: number
  // Time-based goal (only for daily)
  timeTarget?: number  // Target time in minutes
  timeCurrent?: number // Current time in minutes
}

// Aggregated statistics for a single day
export interface DailyStats {
  date: string              // YYYY-MM-DD format
  totalWordsAdded: number
  totalWordsDeleted: number
  netWords: number          // totalWordsAdded - totalWordsDeleted
  totalMinutes: number      // Total writing time
  sessionCount: number      // Number of sessions
  goalReached: boolean      // Whether daily goal was met
}

// Streak information for tracking consecutive writing days
export interface StreakInfo {
  current: number           // Current streak in days
  longest: number           // Longest streak ever achieved
  lastWritingDate: string   // YYYY-MM-DD of last writing day
}

export interface StatsData {
  sessions: WritingSession[]
  dailyStats: DailyStats[]
  goals: WritingGoal[]
  totalWords: number
  streak: StreakInfo
  manuscriptMode: ManuscriptMode
}

export interface Project {
  meta: ProjectMeta
  manuscript: ManuscriptStructure
  sheets: {
    characters: CharacterSheet[]
    locations: LocationSheet[]
    plots: PlotSheet[]
    notes: NoteSheet[]
  }
  stats: StatsData
}
