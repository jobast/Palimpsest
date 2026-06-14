import type { WikiCategory } from './types.js'

export interface WikiTemplate {
  id: string
  label: string
  category: WikiCategory
  type?: string
  body: string
}

export const WIKI_TEMPLATES: WikiTemplate[] = [
  {
    id: 'mystere', label: 'Mystère / énigme', category: 'structure', type: 'mystere',
    body: [
      '## Question', '', '## Indices semés', '', '## Fausses pistes', '',
      '## Révélation prévue', '', '## Statut', '', '(ouvert / en cours / révélé)', ''
    ].join('\n')
  },
  {
    id: 'chronologie', label: 'Chronologie', category: 'structure', type: 'chronologie',
    body: ['## Repères datés', '', '## Ellipses', '', '## Ordre des événements', ''].join('\n')
  },
  {
    id: 'etat_connaissance', label: 'État de connaissance', category: 'structure', type: 'etat_connaissance',
    body: ['## Qui sait quoi', '', '| Personnage | Information | Sait ? | Depuis | Note |', '|---|---|---|---|---|', ''].join('\n')
  },
  {
    id: 'pov', label: 'Point de vue narratif', category: 'ecriture', type: 'pov',
    body: ['## Distance', '', '## Temporalité', '', '## Registre sensoriel', '', '## Ce qu\'il/elle ignore', ''].join('\n')
  },
  {
    id: 'voix_personnage', label: 'Voix d\'un personnage', category: 'ecriture', type: 'voix_personnage',
    body: ['## Registre', '', '## Tics de langage', '', '## Exemple de dialogue', '', '> '].join('\n')
  },
  {
    id: 'libre', label: 'Note libre', category: 'notes',
    body: ''
  }
]

export function getTemplate(id: string): WikiTemplate | undefined {
  return WIKI_TEMPLATES.find(t => t.id === id)
}
