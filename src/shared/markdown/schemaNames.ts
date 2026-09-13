import { SUPPORTED_BLOCK_TYPES, SUPPORTED_MARK_TYPES } from './body.js'

/**
 * Every content-bearing node and mark the editor registers (EditorArea.tsx:
 * StarterKit + Underline + Highlight + SceneBreak + ChapterTitle + FirstParagraph).
 * Adding an extension there without extending the codec must fail the parity test.
 */
export const EDITOR_NODE_AND_MARK_NAMES: readonly string[] = [
  // StarterKit nodes
  'paragraph', 'text', 'heading', 'hardBreak', 'horizontalRule', 'blockquote', 'codeBlock',
  'bulletList', 'orderedList', 'listItem',
  // StarterKit marks
  'bold', 'italic', 'strike', 'code',
  // project extensions
  'underline', 'highlight', 'sceneBreak', 'chapterTitle', 'firstParagraph'
]

/** Schema entries that carry no content and are legitimately outside the codec. */
export const NON_CONTENT_SCHEMA_NAMES: ReadonlySet<string> = new Set(['doc'])

export const CODEC_SUPPORTED_NAMES: ReadonlySet<string> = new Set(
  Array.from(SUPPORTED_BLOCK_TYPES).concat(Array.from(SUPPORTED_MARK_TYPES))
)
