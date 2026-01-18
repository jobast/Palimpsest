import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

export interface DialogueDashOptions {
  dashCharacter: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueDash: {
      insertDialogueDash: () => ReturnType
      toggleDialogueMode: () => ReturnType
    }
  }
}

export const DialogueDash = Extension.create<DialogueDashOptions>({
  name: 'dialogueDash',

  addOptions() {
    return {
      dashCharacter: '— ' // Em dash with space (French dialogue style)
    }
  },

  addCommands() {
    return {
      insertDialogueDash:
        () =>
        ({ commands }) => {
          return commands.insertContent(this.options.dashCharacter)
        },

      toggleDialogueMode:
        () =>
        ({ editor, commands }) => {
          const { selection } = editor.state
          const { $from } = selection

          // Get the current paragraph
          const paragraph = $from.parent
          const text = paragraph.textContent

          // Check if line already starts with dash
          if (text.startsWith('— ') || text.startsWith('—')) {
            // Remove the dash
            const start = $from.start()
            const dashLength = text.startsWith('— ') ? 2 : 1
            return commands.deleteRange({
              from: start,
              to: start + dashLength
            })
          } else {
            // Add dash at the beginning of the paragraph
            const start = $from.start()
            return commands.insertContentAt(start, this.options.dashCharacter)
          }
        }
    }
  },

  addInputRules() {
    return [
      // Convert "-- " at the start of a line to em dash
      new InputRule({
        find: /^--\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange(range)
          commands.insertContent(this.options.dashCharacter)
        }
      }),
      // Convert "--" anywhere to em dash
      new InputRule({
        find: /--$/,
        handler: ({ range, commands }) => {
          commands.deleteRange(range)
          commands.insertContent('—')
        }
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl + Shift + D to insert dialogue dash
      'Mod-Shift-d': () => this.editor.commands.insertDialogueDash(),
      // Alt + D to toggle dialogue mode for current paragraph
      'Alt-d': () => this.editor.commands.toggleDialogueMode()
    }
  }
})
