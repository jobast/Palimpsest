import type { CharacterSheet, AIReport } from '@shared/types/project'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { createAIClientFromStore } from '@/lib/ai'

const CHARACTER_ENRICH_PROMPT = `Tu es un consultant litteraire expert en creation de personnages. Ton role est de proposer des enrichissements concrets pour completer une fiche personnage.

## Personnage actuel

Nom: {name}
Role: {role}

Description:
{description}

Description physique:
{physicalDescription}

Histoire personnelle:
{backstory}

Objectifs et motivations:
{goals}

Defauts et faiblesses:
{flaws}

Notes:
{notes}

---

## Ta tache

Pour chaque champ qui est vide ou peu developpe, propose du contenu concret que l'auteur pourrait utiliser directement ou adapter.

Reponds en Markdown avec cette structure:

### Description physique
{Si vide ou peu developpe, propose 2-3 options de descriptions physiques detaillees. Sinon, suggere des ajouts.}

### Histoire personnelle
{Propose des elements de backstory coherents avec le role du personnage: origines, evenements marquants, trauma, etc.}

### Objectifs et motivations
{Propose des objectifs clairs et des motivations profondes qui pourraient driver ce personnage.}

### Defauts et faiblesses
{Propose des defauts interessants qui creent du conflit et de la tension narrative.}

### Details supplementaires
- **Tics ou habitudes**: ...
- **Peurs secretes**: ...
- **Relation avec les autres**: ...

Sois creatif mais coherent. Propose des options variees pour que l'auteur puisse choisir.`

function buildPrompt(character: CharacterSheet): string {
  const roleLabels: Record<string, string> = {
    protagonist: 'Protagoniste',
    antagonist: 'Antagoniste',
    secondary: 'Personnage secondaire',
    minor: 'Figurant'
  }

  return CHARACTER_ENRICH_PROMPT
    .replace('{name}', character.name)
    .replace('{role}', roleLabels[character.role] || character.role)
    .replace('{description}', character.description || '(vide)')
    .replace('{physicalDescription}', character.physicalDescription || '(vide)')
    .replace('{backstory}', character.backstory || '(vide)')
    .replace('{goals}', character.goals || '(vide)')
    .replace('{flaws}', character.flaws || '(vide)')
    .replace('{notes}', character.notes || '(vide)')
}

export async function generateCharacterEnrichment(character: CharacterSheet): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    const prompt = buildPrompt(character)
    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.8 // Slightly more creative
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'character-analysis',
      title: `Enrichissement: ${character.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'character', id: character.id }],
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
