export type WikiCategory =
  | 'personnages' | 'lieux' | 'intrigues' | 'structure' | 'ecriture' | 'notes'

export const WIKI_CATEGORIES: WikiCategory[] =
  ['personnages', 'lieux', 'intrigues', 'structure', 'ecriture', 'notes']

export interface Fiche {
  slug: string
  category: WikiCategory
  title: string
  created: string
  body: string
  lastUpdated?: string
  sources?: string[]
  type?: string
  meta?: Record<string, unknown>
}

export type SuggestionType = 'nouvelle_fiche' | 'ajout' | 'incoherence'
export interface Suggestion {
  id: string
  type: SuggestionType
  cible: string
  title: string
  resume: string
  body: string
  sourceChapitre?: string
}

export interface FicheRef { category: WikiCategory; slug: string }
export interface IntegrationRecord {
  at: string
  created: FicheRef[]
  appended: FicheRef[]
  alerts: string[]
}

export type AlertType = 'contradiction' | 'nom_manquant' | 'decision' | 'autre'
export type AlertStatus = 'ouverte' | 'resolue'
export interface Alert {
  id: string
  type: AlertType
  title: string
  resume: string
  body: string
  created: string
  status: AlertStatus
}
