import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * FrenchSpaces Extension
 *
 * Normalizes spaces in French text:
 * - Keeps non-breaking spaces (NBSP) only where required by French typography:
 *   - After « (opening guillemet)
 *   - Before » (closing guillemet)
 *   - Before : ; ? !
 * - Converts all other NBSP to regular spaces to allow proper text justification
 */
export const FrenchSpaces = Extension.create({
  name: 'frenchSpaces',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('frenchSpaces'),

        // Transform pasted content to normalize spaces
        transformPasted(slice) {
          return slice
        },

        // On each transaction, normalize spaces
        appendTransaction(transactions, oldState, newState) {
          // Only process if content changed
          const docChanged = transactions.some(tr => tr.docChanged)
          if (!docChanged) return null

          const { tr } = newState
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return

            const text = node.text
            // Non-breaking space character
            const nbsp = '\u00A0'

            // Characters that require NBSP before them in French
            const needsNbspBefore = /[»:;?!]/
            // Characters that require NBSP after them in French
            const needsNbspAfter = /[«]/

            let newText = ''
            let hasChanges = false

            for (let i = 0; i < text.length; i++) {
              const char = text[i]
              const nextChar = text[i + 1]
              const prevChar = text[i - 1]

              if (char === nbsp) {
                // Keep NBSP if next char needs it before, or prev char needs it after
                const keepNbsp =
                  (nextChar && needsNbspBefore.test(nextChar)) ||
                  (prevChar && needsNbspAfter.test(prevChar))

                if (keepNbsp) {
                  newText += nbsp
                } else {
                  // Replace with regular space
                  newText += ' '
                  hasChanges = true
                }
              } else {
                newText += char
              }
            }

            if (hasChanges) {
              // Replace the text node content
              const from = pos
              const to = pos + text.length
              tr.replaceWith(from, to, newState.schema.text(newText, node.marks))
              modified = true
            }
          })

          return modified ? tr : null
        }
      })
    ]
  }
})
