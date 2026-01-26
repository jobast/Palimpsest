import type { AIReport, ManuscriptItem } from '@shared/types/project'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useAIStore } from '@/stores/aiStore'
import { createAIClientFromStore } from '@/lib/ai'

const EDITORIAL_FEEDBACK_PROMPT = `Tu es un editeur litteraire experimente. Analyse ce chapitre et fournis un feedback editorial constructif.

## Chapitre: {title}

{content}

---

## Ta tache

Fournis un feedback editorial structure en Markdown:

### 1. Impression generale
Un paragraphe sur l'impression globale a la lecture.

### 2. Structure
- Organisation du chapitre
- Equilibre des scenes
- Transitions

### 3. Style et ecriture
- Voix narrative
- Fluidite de la prose
- Choix lexicaux

### 4. Rythme
- Pacing
- Equilibre description/action/dialogue
- Moments de tension vs repos

### 5. Points forts
Ce qui fonctionne particulierement bien.

### 6. Axes d'amelioration
Suggestions concretes et prioritaires.

### 7. Phrases a retravailler
Cite 3-5 passages specifiques qui pourraient etre ameliores, avec des suggestions.

Sois constructif, precis et bienveillant. Ton but est d'aider l'auteur a progresser.`

const STYLE_ANALYSIS_PROMPT = `Tu es un analyste litteraire specialise dans le style d'ecriture. Analyse le style de ce texte en profondeur.

## Texte a analyser

{content}

---

## Ta tache

Fournis une analyse stylistique en Markdown:

### Voix narrative
- Type de narration (1ere/3e personne, omniscient/limite)
- Ton general
- Distance narrative

### Registre de langue
- Niveau de langue
- Vocabulaire caracteristique
- Tics de langage (si presents)

### Construction des phrases
- Longueur moyenne des phrases
- Variete syntaxique
- Rythme de la prose

### Figures de style
- Metaphores et comparaisons utilisees
- Repetitions (voulues ou non)
- Autres procedes stylistiques

### Dialogues (si presents)
- Naturel des echanges
- Caracterisation par le dialogue
- Equilibre dialogue/narration

### Recommandations stylistiques
3-5 conseils pour affiner le style.`

function extractTextContent(jsonContent: string): string {
  try {
    const doc = JSON.parse(jsonContent)
    const extractText = (node: any): string => {
      if (node.text) return node.text
      if (node.content) return node.content.map(extractText).join('')
      return ''
    }
    return extractText(doc)
  } catch {
    return jsonContent
  }
}

export async function generateEditorialFeedback(chapter: ManuscriptItem): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()
  const editorStore = useEditorStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  // Get chapter content
  const content = editorStore.getDocumentContent(chapter.id)
  if (!content) {
    throw new Error('Contenu du chapitre non trouve')
  }

  const textContent = extractTextContent(content)
  if (textContent.length < 100) {
    throw new Error('Le chapitre est trop court pour une analyse')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    // Limit content to avoid token limits (roughly 15k chars = 4k tokens)
    const truncatedContent = textContent.length > 15000
      ? textContent.slice(0, 15000) + '\n\n[... texte tronque pour l\'analyse ...]'
      : textContent

    const prompt = EDITORIAL_FEEDBACK_PROMPT
      .replace('{title}', chapter.title)
      .replace('{content}', truncatedContent)

    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2500,
      temperature: 0.7
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'editorial-feedback',
      title: `Feedback: ${chapter.title}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'chapter', id: chapter.id }],
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

export async function generateStyleAnalysis(chapter: ManuscriptItem): Promise<void> {
  const aiStore = useAIStore.getState()
  const projectStore = useProjectStore.getState()
  const editorStore = useEditorStore.getState()

  if (!aiStore.hasValidApiKey()) {
    throw new Error('Cle API non configuree')
  }

  const content = editorStore.getDocumentContent(chapter.id)
  if (!content) {
    throw new Error('Contenu du chapitre non trouve')
  }

  const textContent = extractTextContent(content)
  if (textContent.length < 100) {
    throw new Error('Le chapitre est trop court pour une analyse')
  }

  aiStore.setLoading(true)
  aiStore.setError(null)

  try {
    const client = createAIClientFromStore()

    const truncatedContent = textContent.length > 15000
      ? textContent.slice(0, 15000) + '\n\n[... texte tronque pour l\'analyse ...]'
      : textContent

    const prompt = STYLE_ANALYSIS_PROMPT.replace('{content}', truncatedContent)
    const context = aiStore.advancedMode ? prompt : undefined

    const response = await client.chat({
      model: aiStore.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.6
    })

    // Track usage
    aiStore.addUsage(response.tokensUsed.input, response.tokensUsed.output)

    const report: AIReport = {
      id: crypto.randomUUID(),
      type: 'editorial-feedback',
      title: `Style: ${chapter.title}`,
      createdAt: new Date().toISOString(),
      params: {
        model: aiStore.selectedModel,
        provider: aiStore.selectedProvider
      },
      context,
      linkedEntities: [{ type: 'chapter', id: chapter.id }],
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
