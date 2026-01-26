import type { AIReport, ManuscriptItem } from '@shared/types/project'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useAIStore } from '@/stores/aiStore'
import { createAIClientFromStore } from '@/lib/ai'

// Phase 1: Analyze individual chapter
const CHAPTER_SUMMARY_PROMPT = `Tu es un assistant editorial. Analyse ce chapitre et produis un resume structure.

## Chapitre: {title}

{content}

---

## Ta tache

Produis un resume structure en JSON (pas de markdown, juste le JSON):

{
  "titre": "titre du chapitre",
  "resume": "resume en 2-3 phrases",
  "personnages": ["liste des personnages presents"],
  "lieux": ["lieux mentionnes"],
  "evenements_cles": ["3-5 evenements importants"],
  "ton": "ton dominant (dramatique, leger, tendu, etc.)",
  "themes": ["themes abordes"],
  "questions_ouvertes": ["questions narratives non resolues"],
  "liens_intrigue": "comment ce chapitre fait avancer l'intrigue"
}

Reponds UNIQUEMENT avec le JSON, sans commentaires.`

// Phase 2: Global synthesis from all summaries
const GLOBAL_SYNTHESIS_PROMPT = `Tu es un editeur litteraire experimente. A partir des resumes de tous les chapitres, produis une synthese globale du manuscrit.

## Resumes des chapitres

{summaries}

---

## Ta tache

Produis une analyse globale en Markdown:

### Vue d'ensemble
Un paragraphe resumant l'histoire complete.

### Arc narratif
- **Exposition**: Comment l'histoire commence
- **Developpement**: Les tensions qui se construisent
- **Climax**: Le point culminant (si atteint)
- **Resolution**: Comment les choses se resolvent (si applicable)

### Personnages principaux
Pour chaque personnage majeur:
- Apparitions et evolution
- Arc narratif du personnage

### Themes centraux
Les themes qui traversent l'oeuvre.

### Coherence narrative
- Points forts de la coherence
- Incoherences potentielles detectees
- Questions non resolues

### Rythme et structure
- Equilibre des chapitres
- Pacing global
- Suggestions de restructuration si necessaire

### Recommandations editoriales
5-7 suggestions concretes pour ameliorer le manuscrit.

Sois precis, constructif et base ton analyse sur les donnees fournies.`

interface ChapterSummary {
  chapterId: string
  title: string
  summary: {
    titre: string
    resume: string
    personnages: string[]
    lieux: string[]
    evenements_cles: string[]
    ton: string
    themes: string[]
    questions_ouvertes: string[]
    liens_intrigue: string
  }
}

function extractTextContent(jsonContent: string): string {
  try {
    const doc = JSON.parse(jsonContent)
    const extractText = (node: unknown): string => {
      if (typeof node !== 'object' || node === null) return ''
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.content)) return n.content.map(extractText).join('')
      return ''
    }
    return extractText(doc)
  } catch {
    return jsonContent
  }
}

function flattenManuscript(items: ManuscriptItem[]): ManuscriptItem[] {
  const result: ManuscriptItem[] = []
  for (const item of items) {
    // Only include items that are chapters/scenes (have content)
    if (item.type === 'chapter' || item.type === 'scene') {
      result.push(item)
    }
    if (item.children) {
      result.push(...flattenManuscript(item.children))
    }
  }
  return result
}

export interface AnalysisProgress {
  phase: 'chapters' | 'synthesis'
  current: number
  total: number
  currentChapter?: string
}

export async function analyzeManuscript(
  onProgress?: (progress: AnalysisProgress) => void
): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()
  const editorStore = useEditorStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  const project = projectStore.project
  if (!project) {
    throw new Error('Aucun projet ouvert')
  }

  // Get all chapters
  const chapters = flattenManuscript(project.manuscript.items)
  if (chapters.length === 0) {
    throw new Error('Le manuscrit ne contient aucun chapitre')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  const summaries: ChapterSummary[] = []

  try {
    const client = createAIClientFromStore()

    // Phase 1: Analyze each chapter
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i]

      onProgress?.({
        phase: 'chapters',
        current: i + 1,
        total: chapters.length,
        currentChapter: chapter.title
      })

      const content = editorStore.getDocumentContent(chapter.id)
      if (!content) continue

      const textContent = extractTextContent(content)
      if (textContent.length < 50) continue // Skip very short chapters

      // Truncate if too long (roughly 10k chars = 2.5k tokens)
      const truncatedContent = textContent.length > 10000
        ? textContent.slice(0, 10000) + '\n\n[... texte tronque ...]'
        : textContent

      const prompt = CHAPTER_SUMMARY_PROMPT
        .replace('{title}', chapter.title)
        .replace('{content}', truncatedContent)

      try {
        const response = await client.chat({
          model: aiStore.selectedModel,
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 800,
          temperature: 0.3 // More deterministic for structured output
        })

        // Track usage
        aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

        // Parse JSON response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const summary = JSON.parse(jsonMatch[0])
          summaries.push({
            chapterId: chapter.id,
            title: chapter.title,
            summary
          })
        }
      } catch (err) {
        console.warn(`Failed to analyze chapter ${chapter.title}:`, err)
        // Continue with other chapters
      }
    }

    if (summaries.length === 0) {
      throw new Error('Aucun chapitre n\'a pu etre analyse')
    }

    // Phase 2: Global synthesis
    onProgress?.({
      phase: 'synthesis',
      current: 1,
      total: 1
    })

    const summariesText = summaries.map((s, i) =>
      `## Chapitre ${i + 1}: ${s.title}\n` +
      `Resume: ${s.summary.resume}\n` +
      `Personnages: ${s.summary.personnages.join(', ')}\n` +
      `Lieux: ${s.summary.lieux.join(', ')}\n` +
      `Evenements: ${s.summary.evenements_cles.join('; ')}\n` +
      `Ton: ${s.summary.ton}\n` +
      `Themes: ${s.summary.themes.join(', ')}\n` +
      `Questions ouvertes: ${s.summary.questions_ouvertes.join('; ')}\n` +
      `Progression: ${s.summary.liens_intrigue}`
    ).join('\n\n---\n\n')

    const synthesisPrompt = GLOBAL_SYNTHESIS_PROMPT.replace('{summaries}', summariesText)

    const synthesisResponse = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: synthesisPrompt }],
      maxTokens: 3000,
      temperature: 0.7
    })

    // Track usage
    aiStore.addUsage(synthesisResponse.tokensUsed.input, synthesisResponse.tokensUsed.output)

    // Create the synthesis report
    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'editorial-feedback',
      title: `Analyse globale: ${project.meta.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context: aiStore.advancedMode ? synthesisPrompt : undefined,
      linkedEntities: chapters.map(c => ({ type: 'chapter' as const, id: c.id })),
      content: synthesisResponse.content,
      tokensUsed: synthesisResponse.tokensUsed
    }

    // Also save chapter summaries as a separate report
    const summariesReport: AIReport = {
      id: crypto.randomUUID(),
      type: 'editorial-feedback',
      title: `Resumes chapitres: ${project.meta.name}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      linkedEntities: chapters.map(c => ({ type: 'chapter' as const, id: c.id })),
      content: formatSummariesAsMarkdown(summaries)
    }

    projectStore.addReport(summariesReport)
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

function formatSummariesAsMarkdown(summaries: ChapterSummary[]): string {
  return summaries.map((s, i) => `
## Chapitre ${i + 1}: ${s.title}

**Resume:** ${s.summary.resume}

**Personnages:** ${s.summary.personnages.join(', ') || 'Aucun'}

**Lieux:** ${s.summary.lieux.join(', ') || 'Aucun'}

**Evenements cles:**
${s.summary.evenements_cles.map(e => `- ${e}`).join('\n')}

**Ton:** ${s.summary.ton}

**Themes:** ${s.summary.themes.join(', ')}

**Questions ouvertes:**
${s.summary.questions_ouvertes.map(q => `- ${q}`).join('\n')}

**Progression de l'intrigue:** ${s.summary.liens_intrigue}
`).join('\n---\n')
}
