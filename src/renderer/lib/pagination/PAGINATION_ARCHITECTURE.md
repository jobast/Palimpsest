# Pagination System Architecture

## Overview

Palimpseste uses a **ProseMirror Decorations** approach for pagination. This allows
the editor to remain a single continuous editable document while visually displaying
content across fixed-size pages.

```
┌─────────────────────────────────────────────────────────────┐
│ usePagination() → calculatePageBreaks() → paginationStore   │
│         ↓                                                   │
│ PageBreakDecorations (widgets spacers aux positions breaks) │
│         ↓                                                   │
│ PagedEditor (page frames en overlay + EditorContent unique) │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `pageBreakCalculator.ts` | Measures DOM nodes and calculates page break positions |
| `PageBreakDecorations.ts` | ProseMirror extension that inserts spacer widgets at page breaks |
| `PagedEditor.tsx` | Renders page frames as overlays, positions editor content |
| `paginationStore.ts` | Zustand store holding pagination state (pages, positions) |
| `usePagination.ts` | React hook that triggers recalculation on content changes |
| `constants.ts` | Shared constants (PAGE_GAP, HEADER_HEIGHT, FOOTER_HEIGHT) |
| `globals.css` | CSS rules for `.manuscript-content` and `.manuscript-editor` |

## How It Works

### 1. Measurement Phase (`calculatePageBreaks`)

```typescript
doc.forEach((node, offset) => {
  // Get actual DOM element from editor
  const domNode = editor.view.nodeDOM(offset)

  // Clone and measure in hidden container
  const clone = domNode.cloneNode(true)
  measurementContainer.appendChild(clone)
  const height = measureNodeHeight(clone)  // includes margins

  // Track cumulative height, create page break when overflow
  if (currentHeight + height > contentHeight) {
    pageBreakPositions.push(offset)
    currentHeight = height
  } else {
    currentHeight += height
  }
})
```

### 2. Decoration Phase (`PageBreakDecorations`)

For each page break position, a spacer widget is inserted:

```typescript
const spacerHeight = remainingSpaceOnPage + interPageSpace
// interPageSpace = marginBottom + footerHeight + PAGE_GAP + marginTop + headerHeight

Decoration.widget(position, () => {
  const spacer = document.createElement('div')
  spacer.style.height = `${spacerHeight}px`
  return spacer
})
```

### 3. Rendering Phase (`PagedEditor`)

- Page frames are absolute-positioned overlays with `pointer-events: none`
- Single `EditorContent` flows through all pages
- Spacers push content to align with page content areas

## Critical Invariants

### CSS Class Consistency

**CRITICAL**: The measurement container and the actual editor MUST use CSS classes
with identical rules for all elements:

```css
/* Both must have matching rules for these elements: */
.manuscript-content p { ... }
.manuscript-content blockquote { ... }
.manuscript-content ul, ol { ... }
.manuscript-content li { ... }
.manuscript-content hr { ... }
.manuscript-content h1, h2, h3 { ... }
.manuscript-content [data-type="chapter-title"] { ... }

.manuscript-editor.ProseMirror p { ... }
/* ... same rules ... */
```

**If CSS rules differ, measurement will be wrong → cumulative drift!**

### Oversized Node Handling

Nodes taller than page height cannot be split. The calculator must:

1. Detect: `if (nodeHeight > dims.contentHeight)`
2. Force page break before the node
3. Cap height to page height to prevent cascade

```typescript
if (nodeHeight > dims.contentHeight) {
  // Force page break if not at page start
  if (currentHeight > 0) {
    pageBreakPositions.push(offset)
    currentHeight = 0
  }
  // Cap to prevent cascade
  currentHeight = dims.contentHeight
  return
}
```

### Typography Consistency

Measurement must use the same typography as rendering:

```typescript
// Use effectiveTypography (includes user overrides), not template.typography
const typography = effectiveTypography || template.typography
applyManuscriptStyles(clone, typography)
```

## Debugging Pagination Issues

### Symptom: Cumulative Vertical Drift

Text progressively shifts down/up across pages.

**Causes to check:**
1. CSS divergence between `.manuscript-content` and `.manuscript-editor`
2. Oversized nodes not being handled
3. Typography mismatch between measurement and rendering

**Debug approach:**
```typescript
// Add to processNodeHeight:
console.log({
  nodeType: node.type.name,
  measuredHeight: nodeHeight,
  currentHeight,
  contentHeight: dims.contentHeight,
  wouldOverflow: currentHeight + nodeHeight > dims.contentHeight
})
```

### Symptom: Content Jumps After Typing

**Cause:** Pagination recalculation is debounced. Content renders, then spacers update.

**Fix:** Reduce debounce time in `usePagination.ts`:
```typescript
debounce(() => { ... }, 16)  // 16ms = one frame
```

### Symptom: Wrong Page Numbers

**Cause:** PAGE_GAP inconsistency between files.

**Fix:** All files must import from `constants.ts`:
```typescript
import { PAGE_GAP, HEADER_HEIGHT, FOOTER_HEIGHT } from '@/lib/pagination'
```

## Future Improvements

1. **Virtual Scrolling**: Only render visible pages for large documents
2. **Node Splitting**: Split paragraphs that exceed page height
3. **Inline Page Breaks**: Allow manual page breaks within content
4. **Print Preview**: Separate view mode for print-accurate preview

## Historical Issues Fixed

### January 2026: Cumulative Drift Fix (Phase 1)

**Problem:** Pages had cumulative vertical drift making editor unusable.

**Root causes:**
1. `.manuscript-content` missing blockquote/list/hr CSS rules
2. Oversized nodes not handled → cascading errors
3. Typography overrides not passed to measurement

**Solution:** See commit `f194442` for full details.

### January 2026: Measurement Fix (Phase 2)

**Problem:** Clone-based measurement returned incorrect heights (1900-3000px for
nodes that should be 17-50px). This caused:
- Only 2-3 pages generated regardless of content
- Text flowing continuously without stopping at page boundaries
- Every node being detected as "oversized"

**Root cause:**
The clone-and-measure-in-hidden-container approach was fundamentally broken:
- Cloned nodes lost their layout context
- Hidden container's visibility:hidden prevented proper layout calculation
- Measurement returned container/document height instead of individual node height

**Solution:**
Changed to **direct DOM measurement** - measure nodes directly in the editor's
already-rendered DOM rather than cloning:

```typescript
// OLD (broken): Clone to hidden container
const clone = domNode.cloneNode(true)
measurementContainer.appendChild(clone)
const height = measureNodeHeight(clone)  // WRONG: returns huge values

// NEW (working): Measure in-place
const height = measureNodeInEditor(domNode)  // CORRECT: actual rendered height
```

Key changes:
- `measureNodeInEditor()` measures nodes directly via `getBoundingClientRect()`
- Width ratio scaling accounts for zoom levels
- No more hidden measurement container needed
- Removed unused `applyManuscriptStyles()` function

**Result:**
- Correct height measurements (17-50px for paragraphs, 300+px for chapter titles)
- Pages break correctly at content boundaries
- Text properly contained within page frames
- Works across all templates

## Known Limitations

### Paragraph Splitting (Not Yet Implemented)

Paragraphs are treated as atomic units. When a paragraph doesn't fit on the
current page, the ENTIRE paragraph moves to the next page. This can cause:
- Large whitespace at the bottom of pages
- Paragraph "jumping" when typing near page boundaries

**Why this happens:**
ProseMirror nodes are atomic - we can only break BETWEEN nodes, not within them.

**Future solution:** Implement paragraph splitting by:
1. Detecting when a paragraph would overflow
2. Calculating the split point based on line height
3. Creating a visual "continuation" that renders the split content

This is tracked as a future improvement in the roadmap.
