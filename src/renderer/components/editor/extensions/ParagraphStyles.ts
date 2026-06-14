import { Node, mergeAttributes, canInsertNode } from '@tiptap/core'

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
      // Insert the break followed by an empty paragraph (the start of the next
      // scene). TipTap places the cursor in that paragraph — we never build a
      // manual selection, which avoids invalid-selection errors with this atom
      // node. The break is never placed before/inside the chapter title.
      insertSceneBreak:
        () =>
        ({ commands, state }) => {
          if (!canInsertNode(state, state.schema.nodes[this.name])) {
            return false
          }
          const { $from } = state.selection
          const firstChild = state.doc.firstChild
          const inTitle = firstChild?.type.name === 'chapterTitle' && $from.index(0) === 0
          const content = [{ type: this.name }, { type: 'paragraph' }]
          if (inTitle) {
            return commands.insertContentAt(firstChild!.nodeSize, content)
          }
          return commands.insertContent(content)
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
