import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { useWikiStore } from '@/stores/wikiStore'
import { writeAgentDoc, recordIntegration } from '@/lib/wiki/wikiIO'
import { docToMarkdownBody } from '@shared/markdown'
import { hashContent, emptyIntegrationRecord } from '@shared/wiki'

export interface AgentResult { ok: boolean; summary?: string; error?: string }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Markdown of a chapter from the editor store (same source the pipeline hashes/ingests). */
function chapterMarkdown(chapterId: string): string {
  const raw = useEditorStore.getState().getDocumentContent(chapterId)
  if (!raw) return ''
  try { return docToMarkdownBody(JSON.parse(raw)) } catch { return '' }
}

/**
 * Run the real Claude Code agent over the given chapters: it edits the wiki autonomously
 * following wiki/CLAUDE.md. On success, record each chapter's content hash so the ingest
 * menu shows them up-to-date, then reload the wiki.
 */
export async function runAgentIngest(
  chapterIds: string[],
  onProgress: (evt: { kind: string; label: string }) => void
): Promise<AgentResult> {
  const project = useProjectStore.getState().project
  const projectPath = useProjectStore.getState().projectPath
  const chapterRefs = useProjectStore.getState().chapterRefs
  if (!project || !projectPath) return { ok: false, error: 'Aucun projet ouvert' }
  if (!chapterIds.length) return { ok: false, error: 'Aucun chapitre sélectionné' }

  const manualPath = await writeAgentDoc(projectPath, project.meta.name, project.meta.author || '')

  const files = chapterIds
    .map(id => chapterRefs.find(r => r.id === id)?.file)
    .filter((f): f is string => !!f)
  const task = `Mets à jour l'Univers (le wiki) pour ces chapitres du manuscrit, en suivant STRICTEMENT le manuel d'opération fourni (format des fiches, mécanisme sources:, alertes de contradiction, n'invente rien) :\n${files.map(f => `- ${f}`).join('\n')}\n\nPour chaque chapitre : applique la grille de lecture, crée/enrichis les fiches affectées sous wiki/<categorie>/, ajoute le chapitre à leur sources:, crée des alertes wiki/_alertes/ en cas de contradiction ou de décision d'auteur, et appends à wiki/log.md. Mets à jour wiki/index.md à la fin.`

  window.electronAPI.onWikiAgentProgress(onProgress)
  try {
    const res = await window.electronAPI.runWikiAgent({ projectPath, task, manualPath })
    if (res.ok) {
      for (const id of chapterIds) {
        await recordIntegration(projectPath, id, { ...emptyIntegrationRecord(today()), chapterHash: hashContent(chapterMarkdown(id)) })
      }
      await useWikiStore.getState().loadWiki(projectPath)
    }
    return res
  } finally {
    window.electronAPI.offWikiAgentProgress()
  }
}

export function cancelAgent(): void {
  void window.electronAPI.cancelWikiAgent()
}
