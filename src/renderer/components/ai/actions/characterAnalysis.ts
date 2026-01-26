import type { CharacterSheet, AIReport } from '@shared/types/project'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { createAIClientFromStore } from '@/lib/ai'

const CHARACTER_ANALYSIS_PROMPT = `Tu es un consultant litteraire expert en creation de personnages. Analyse le personnage suivant et fournis un rapport detaille.

## Personnage a analyser

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

Fournis une analyse structuree en Markdown avec les sections suivantes:

### 1. Synthese du personnage
Un paragraphe resumant qui est ce personnage et son role dans l'histoire.

### 2. Points forts
- Ce qui rend ce personnage interessant
- Elements bien developpes

### 3. Axes d'amelioration
- Ce qui pourrait etre approfondi
- Questions sans reponse
- Incoherences potentielles

### 4. Arc narratif potentiel
- Evolution possible du personnage
- Conflits interieurs a exploiter
- Transformation envisageable

### 5. Suggestions concretes
3-5 suggestions pratiques pour enrichir ce personnage.

Sois constructif et specifique. Adapte ton analyse au genre litteraire si tu peux le deviner.`

function buildPrompt(character: CharacterSheet): string {
  const roleLabels: Record<string, string> = {
    protagonist: 'Protagoniste',
    antagonist: 'Antagoniste',
    secondary: 'Personnage secondaire',
    minor: 'Figurant'
  }

  return CHARACTER_ANALYSIS_PROMPT
    .replace('{name}', character.name)
    .replace('{role}', roleLabels[character.role] || character.role)
    .replace('{description}', character.description || '(non renseigne)')
    .replace('{physicalDescription}', character.physicalDescription || '(non renseigne)')
    .replace('{backstory}', character.backstory || '(non renseigne)')
    .replace('{goals}', character.goals || '(non renseigne)')
    .replace('{flaws}', character.flaws || '(non renseigne)')
    .replace('{notes}', character.notes || '(non renseigne)')
}

export async function generateCharacterAnalysis(character: CharacterSheet): Promise<void> {
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
      temperature: 0.7
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    // Create the report
    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'character-analysis',
      title: `Analyse: ${character.name}`,
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

    // Add report and show it
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
