import type { LocationSheet, AIReport } from '@shared/types/project'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { createAIClientFromStore } from '@/lib/ai'

const LOCATION_ENRICH_PROMPT = `Tu es un consultant litteraire expert en creation d'univers et de decors. Ton role est d'enrichir la description d'un lieu pour le rendre plus vivant et immersif.

## Lieu actuel

Nom: {name}

Description:
{description}

Importance dans l'histoire:
{significance}

Details sensoriels:
{sensoryDetails}

Notes:
{notes}

---

## Ta tache

Propose des enrichissements concrets pour ce lieu. Reponds en Markdown:

### Atmosphere generale
Decris l'ambiance, le mood, ce qu'on ressent en entrant dans ce lieu.

### Details visuels
- Architecture, couleurs, lumieres
- Elements distinctifs
- Ce qui attire l'oeil en premier

### Palette sensorielle
- **Sons**: Qu'entend-on?
- **Odeurs**: Quelles sont les odeurs dominantes?
- **Textures**: Que touche-t-on?
- **Temperature/Air**: Quelle sensation sur la peau?

### Vie du lieu
- Qui frequente cet endroit?
- A quels moments est-il different? (jour/nuit, saisons)
- Quelle est son histoire?

### Potentiel narratif
- Quels types de scenes ce lieu inspire-t-il?
- Quels secrets pourrait-il cacher?
- Comment pourrait-il refléter l'etat emotionnel des personnages?

Sois evocateur et specifique. Donne des details concrets que l'auteur peut integrer directement.`

const SENSORY_DETAILS_PROMPT = `Tu es un ecrivain specialise dans les descriptions sensorielles immersives. Genere une description riche en details sensoriels pour ce lieu.

## Lieu

Nom: {name}
Description: {description}

---

## Ta tache

Ecris une description immersive de ce lieu en utilisant tous les sens. La description doit etre:
- Riche en details sensoriels (vue, ouie, odorat, toucher, gout si pertinent)
- Evocatrice et atmospherique
- Utilisable directement dans un roman

Ecris 2-3 paragraphes de prose, pas de liste. Le texte doit couler naturellement comme dans un roman.`

function buildEnrichPrompt(location: LocationSheet): string {
  return LOCATION_ENRICH_PROMPT
    .replace('{name}', location.name)
    .replace('{description}', location.description || '(vide)')
    .replace('{significance}', location.significance || '(non renseigne)')
    .replace('{sensoryDetails}', location.sensoryDetails || '(vide)')
    .replace('{notes}', location.notes || '(vide)')
}

function buildSensoryPrompt(location: LocationSheet): string {
  return SENSORY_DETAILS_PROMPT
    .replace('{name}', location.name)
    .replace('{description}', location.description || '(vide)')
}

export async function generateLocationEnrichment(location: LocationSheet): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    const prompt = buildEnrichPrompt(location)
    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.8
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'character-analysis', // Using same type for now
      title: `Enrichissement: ${location.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'location', id: location.id }],
      content: response.content,
      tokensUsed: response.tokensUsed
    }

    projectStore.addReport(report)
    projectStore.setActiveReport(report.id)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    aiStore.setError(message)
    throw error
  } finally {
    aiStore.setLoading(false)
  }
}

export async function generateSensoryDetails(location: LocationSheet): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    const prompt = buildSensoryPrompt(location)
    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
      temperature: 0.9 // More creative for prose
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'character-analysis',
      title: `Details sensoriels: ${location.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'location', id: location.id }],
      content: response.content,
      tokensUsed: response.tokensUsed
    }

    projectStore.addReport(report)
    projectStore.setActiveReport(report.id)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    aiStore.setError(message)
    throw error
  } finally {
    aiStore.setLoading(false)
  }
}
