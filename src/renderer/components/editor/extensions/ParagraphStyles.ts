import { Node, mergeAttributes, canInsertNode, isNodeSelection } from '@tiptap/core'
import { TextSelection, NodeSelection } from '@tiptap/pm/state'

export interface SceneBreakOptions {
  HTMLAttributes: Record<string, unknown>
}

// Scene break extension (centered asterisks or custom separator)
export const SceneBreak = Node.create<SceneBreakOptions>({
  name: 'sceneBreak',

  group: 'block',

  // Leaf block: a single, indivisible unit (no editable content of its own).
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="scene-break"]' }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'scene-break',
      class: 'scene-break'
    }), ['span', {}, '* * *']]
  },

  addCommands() {
    return {
      // Modeled on TipTap's setHorizontalRule: handles block boundaries, keeps
      // the cursor sane afterward, and never lands before the chapter title.
      insertSceneBreak:
        () =>
        ({ chain, state }) => {
          if (!canInsertNode(state, state.schema.nodes[this.name])) {
            return false
          }

          const { selection } = state
          const { $from: $originFrom, $to: $originTo } = selection
          const firstChild = state.doc.firstChild
          // Caret sitting in the chapter title (the mandatory first node).
          const inTitle = firstChild?.type.name === 'chapterTitle' && $originFrom.index(0) === 0
          const currentChain = chain()

          if (inTitle) {
            // Insert right after the title, never before/inside it.
            currentChain.insertContentAt(firstChild!.nodeSize, { type: this.name })
          } else if ($originFrom.parentOffset === 0) {
            currentChain.insertContentAt(
              { from: Math.max($originFrom.pos - 1, 0), to: $originTo.pos },
              { type: this.name }
            )
          } else if (isNodeSelection(selection)) {
            currentChain.insertContentAt($originTo.pos, { type: this.name })
          } else {
            currentChain.insertContent({ type: this.name })
          }

          return currentChain
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection
                const posAfter = $to.end()
                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1))
                  } else if ($to.nodeAfter.isBlock) {
                    tr.setSelection(NodeSelection.create(tr.doc, $to.pos))
                  } else {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos))
                  }
                } else {
                  // At the end of the doc: add a paragraph after the break.
                  const node = $to.parent.type.contentMatch.defaultType?.create()
                  if (node) {
                    tr.insert(posAfter, node)
                    tr.setSelection(TextSelection.create(tr.doc, posAfter + 1))
                  }
                }
                tr.scrollIntoView()
              }
              return true
            })
            .run()
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () => this.editor.commands.insertSceneBreak()
    }
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneBreak: {
      insertSceneBreak: () => ReturnType
    }
  }
}

// Chapter title extension
export interface ChapterTitleOptions {
  HTMLAttributes: Record<string, unknown>
}

export const ChapterTitle = Node.create<ChapterTitleOptions>({
  name: 'chapterTitle',

  group: 'block',

  content: 'inline*',

  defining: true,

  parseHTML() {
    return [
      { tag: 'h1[data-type="chapter-title"]' }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['h1', mergeAttributes(HTMLAttributes, {
      'data-type': 'chapter-title',
      class: 'chapter-title'
    }), 0]
  },

  addCommands() {
    return {
      setChapterTitle:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleChapterTitle:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        }
    }
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chapterTitle: {
      setChapterTitle: () => ReturnType
      toggleChapterTitle: () => ReturnType
    }
  }
}

// First paragraph (no indent, used after chapter titles)
export interface FirstParagraphOptions {
  HTMLAttributes: Record<string, unknown>
}

export const FirstParagraph = Node.create<FirstParagraphOptions>({
  name: 'firstParagraph',

  group: 'block',

  content: 'inline*',

  parseHTML() {
    return [
      { tag: 'p[data-type="first-paragraph"]' }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, {
      'data-type': 'first-paragraph',
      class: 'first-paragraph'
    }), 0]
  },

  addCommands() {
    return {
      setFirstParagraph:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleFirstParagraph:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        }
    }
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    firstParagraph: {
      setFirstParagraph: () => ReturnType
      toggleFirstParagraph: () => ReturnType
    }
  }
}
