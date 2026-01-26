import type { PlotSheet, AIReport } from '@shared/types/project'
import { useProjectStore } from '@/stores/projectStore'
import { useAIStore } from '@/stores/aiStore'
import { createAIClientFromStore } from '@/lib/ai'

const PLOT_ANALYSIS_PROMPT = `Tu es un consultant litteraire expert en structure narrative. Analyse cette intrigue et fournis un feedback constructif.

## Intrigue a analyser

Titre: {name}
Type: {plotType}

Description:
{description}

Structure en actes:
{acts}

Evenements cles:
{keyEvents}

Notes:
{notes}

---

## Ta tache

Fournis une analyse structuree en Markdown:

### 1. Resume de l'intrigue
Un paragraphe synthétisant l'essence de cette intrigue.

### 2. Structure narrative
- Analyse de la structure actuelle
- Les points de tension identifies
- Le climax potentiel

### 3. Points forts
- Ce qui fonctionne bien
- Elements accrocheurs

### 4. Points a developper
- Elements manquants ou flous
- Questions sans reponse
- Opportunites inexploitees

### 5. Recommandations
3-5 suggestions concretes pour renforcer cette intrigue.

Sois constructif et specifique.`

const PLOT_HOLES_PROMPT = `Tu es un editeur meticuleux specialise dans la detection d'incoherences narratives. Analyse cette intrigue pour trouver les trous potentiels.

## Intrigue

Titre: {name}
Type: {plotType}

Description:
{description}

Structure:
{acts}

Evenements cles:
{keyEvents}

---

## Ta tache

Identifie les problemes potentiels. Reponds en Markdown:

### Incoherences detectees
Liste les contradictions ou elements qui ne tiennent pas logiquement.

### Questions sans reponse
Quelles questions un lecteur attentif se poserait-il?

### Sauts logiques
Y a-t-il des transitions manquantes ou des raccourcis narratifs problematiques?

### Motivations floues
Les actions des personnages impliques sont-elles justifiees?

### Suggestions de correction
Pour chaque probleme identifie, propose une solution.

Si l'intrigue semble coherente, indique-le et suggere des tests de robustesse.`

function buildAnalysisPrompt(plot: PlotSheet): string {
  const plotTypeLabels: Record<string, string> = {
    main: 'Intrigue principale',
    subplot: 'Intrigue secondaire'
  }

  const actsText = plot.acts?.map((a, i) => `Acte ${i + 1}: ${a.title}\n${a.description}`).join('\n\n') || '(non defini)'
  const eventsText = plot.keyEvents?.join('\n- ') || '(non defini)'

  return PLOT_ANALYSIS_PROMPT
    .replace('{name}', plot.name)
    .replace('{plotType}', plotTypeLabels[plot.plotType] || plot.plotType)
    .replace('{description}', plot.description || '(vide)')
    .replace('{acts}', actsText)
    .replace('{keyEvents}', eventsText ? `- ${eventsText}` : '(non defini)')
    .replace('{notes}', plot.notes || '(vide)')
}

function buildHolesPrompt(plot: PlotSheet): string {
  const plotTypeLabels: Record<string, string> = {
    main: 'Intrigue principale',
    subplot: 'Intrigue secondaire'
  }

  const actsText = plot.acts?.map((a, i) => `Acte ${i + 1}: ${a.title}\n${a.description}`).join('\n\n') || '(non defini)'
  const eventsText = plot.keyEvents?.join('\n- ') || '(non defini)'

  return PLOT_HOLES_PROMPT
    .replace('{name}', plot.name)
    .replace('{plotType}', plotTypeLabels[plot.plotType] || plot.plotType)
    .replace('{description}', plot.description || '(vide)')
    .replace('{acts}', actsText)
    .replace('{keyEvents}', eventsText ? `- ${eventsText}` : '(non defini)')
}

export async function generatePlotAnalysis(plot: PlotSheet): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    const prompt = buildAnalysisPrompt(plot)
    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.7
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'plot-analysis',
      title: `Analyse: ${plot.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'plot', id: plot.id }],
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

export async function findPlotHoles(plot: PlotSheet): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    const prompt = buildHolesPrompt(plot)
    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.6 // More analytical
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'consistency-check',
      title: `Trous narratifs: ${plot.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'plot', id: plot.id }],
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
