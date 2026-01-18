import { useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Lock,
  RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'

const FONT_FAMILIES = [
  { value: 'Garamond, Georgia, serif', label: 'Garamond' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Baskerville, Georgia, serif', label: 'Baskerville' },
  { value: 'Palatino, Georgia, serif', label: 'Palatino' },
  { value: 'Caslon, Georgia, serif', label: 'Caslon' },
  { value: 'Cambria, Georgia, serif', label: 'Cambria' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
]

const FONT_SIZES = [
  '9pt', '10pt', '10.5pt', '11pt', '11.5pt', '12pt', '13pt', '14pt', '16pt', '18pt'
]

const LINE_HEIGHTS = [
  { value: 1.0, label: '1.0 - Simple' },
  { value: 1.15, label: '1.15' },
  { value: 1.3, label: '1.3' },
  { value: 1.4, label: '1.4' },
  { value: 1.5, label: '1.5' },
  { value: 1.6, label: '1.6' },
  { value: 1.8, label: '1.8' },
  { value: 2.0, label: '2.0 - Double' },
]

const FIRST_LINE_INDENTS = [
  { value: '0', label: 'Aucun' },
  { value: '0.5cm', label: '0.5 cm' },
  { value: '0.8cm', label: '0.8 cm' },
  { value: '1cm', label: '1 cm' },
  { value: '1.2cm', label: '1.2 cm' },
  { value: '1.5cm', label: '1.5 cm' },
  { value: '0.25in', label: '0.25"' },
  { value: '0.3in', label: '0.3"' },
  { value: '0.5in', label: '0.5"' },
]

/**
 * FormattingPanel Component
 *
 * Panel for text formatting options in the right sidebar:
 * - Font family and size
 * - Bold, Italic, Underline
 * - Text alignment
 * - First line indent
 * - Line spacing
 */
export function FormattingPanel() {
  const {
    editor,
    currentTemplate,
    userTypographyOverrides,
    setUserTypographyOverride,
    getEffectiveTypography
  } = useEditorStore()
  const { updateTypographyOverrides } = useProjectStore()

  // Get effective typography (template + user overrides)
  const effectiveTypography = getEffectiveTypography()

  // Check if fields have overrides
  const hasFontSizeOverride = userTypographyOverrides.fontSize !== undefined
  const hasLineHeightOverride = userTypographyOverrides.lineHeight !== undefined
  const hasFirstLineIndentOverride = userTypographyOverrides.firstLineIndent !== undefined

  // Handlers for typography changes
  const handleFontSizeChange = useCallback((value: string) => {
    const newValue = value === currentTemplate.typography.fontSize ? null : value
    setUserTypographyOverride('fontSize', newValue)
    // Sync to project store for persistence
    const newOverrides = { ...userTypographyOverrides }
    if (newValue === null) {
      delete newOverrides.fontSize
    } else {
      newOverrides.fontSize = newValue
    }
    updateTypographyOverrides(newOverrides)
  }, [currentTemplate, userTypographyOverrides, setUserTypographyOverride, updateTypographyOverrides])

  const handleLineHeightChange = useCallback((value: number) => {
    const newValue = value === currentTemplate.typography.lineHeight ? null : value
    setUserTypographyOverride('lineHeight', newValue)
    const newOverrides = { ...userTypographyOverrides }
    if (newValue === null) {
      delete newOverrides.lineHeight
    } else {
      newOverrides.lineHeight = newValue
    }
    updateTypographyOverrides(newOverrides)
  }, [currentTemplate, userTypographyOverrides, setUserTypographyOverride, updateTypographyOverrides])

  const handleFirstLineIndentChange = useCallback((value: string) => {
    const newValue = value === currentTemplate.typography.firstLineIndent ? null : value
    setUserTypographyOverride('firstLineIndent', newValue)
    const newOverrides = { ...userTypographyOverrides }
    if (newValue === null) {
      delete newOverrides.firstLineIndent
    } else {
      newOverrides.firstLineIndent = newValue
    }
    updateTypographyOverrides(newOverrides)
  }, [currentTemplate, userTypographyOverrides, setUserTypographyOverride, updateTypographyOverrides])

  const resetToTemplate = useCallback((field: 'fontSize' | 'lineHeight' | 'firstLineIndent') => {
    setUserTypographyOverride(field, null)
    const newOverrides = { ...userTypographyOverrides }
    delete newOverrides[field]
    updateTypographyOverrides(newOverrides)
  }, [userTypographyOverrides, setUserTypographyOverride, updateTypographyOverrides])

  // Format toggle handlers
  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run()
  }, [editor])

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run()
  }, [editor])

  const toggleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run()
  }, [editor])

  const setAlignment = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    editor?.chain().focus().setTextAlign(align).run()
  }, [editor])

  // Check active states
  const isBold = editor?.isActive('bold') ?? false
  const isItalic = editor?.isActive('italic') ?? false
  const isUnderline = editor?.isActive('underline') ?? false
  const isAlignLeft = editor?.isActive({ textAlign: 'left' }) ?? true
  const isAlignCenter = editor?.isActive({ textAlign: 'center' }) ?? false
  const isAlignRight = editor?.isActive({ textAlign: 'right' }) ?? false
  const isAlignJustify = editor?.isActive({ textAlign: 'justify' }) ?? false

  return (
    <div className="p-4 space-y-6">
      {/* Font Section */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Police
        </h3>

        {/* Font Family - Locked */}
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <label className="text-xs text-muted-foreground">Famille</label>
            <Lock size={10} className="text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              className="w-full px-3 py-1.5 pr-8 text-sm rounded border border-input bg-muted/50 appearance-none cursor-not-allowed opacity-70"
              value={currentTemplate.typography.fontFamily}
              disabled
              title="Défini par le template"
            >
              {FONT_FAMILIES.map(font => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
            <Lock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Font Size - Editable */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Taille</label>
            {hasFontSizeOverride && (
              <button
                onClick={() => resetToTemplate('fontSize')}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
                title="Revenir à la valeur du template"
              >
                <RotateCcw size={10} />
              </button>
            )}
          </div>
          <div className="relative">
            <select
              className={cn(
                "w-full px-3 py-1.5 pr-8 text-sm rounded border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
                hasFontSizeOverride
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:border-primary/50"
              )}
              value={effectiveTypography.fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
            >
              {FONT_SIZES.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Style Buttons */}
        <div className="flex gap-1">
          <FormatButton
            icon={<Bold size={16} />}
            active={isBold}
            onClick={toggleBold}
            title="Gras (⌘B)"
          />
          <FormatButton
            icon={<Italic size={16} />}
            active={isItalic}
            onClick={toggleItalic}
            title="Italique (⌘I)"
          />
          <FormatButton
            icon={<Underline size={16} />}
            active={isUnderline}
            onClick={toggleUnderline}
            title="Souligné (⌘U)"
          />
        </div>
      </section>

      {/* Spacing Section */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Espacement
        </h3>

        {/* Text Alignment */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Alignement</label>
          <div className="flex gap-1">
            <FormatButton
              icon={<AlignLeft size={16} />}
              active={isAlignLeft}
              onClick={() => setAlignment('left')}
              title="Aligner à gauche"
            />
            <FormatButton
              icon={<AlignCenter size={16} />}
              active={isAlignCenter}
              onClick={() => setAlignment('center')}
              title="Centrer"
            />
            <FormatButton
              icon={<AlignRight size={16} />}
              active={isAlignRight}
              onClick={() => setAlignment('right')}
              title="Aligner à droite"
            />
            <FormatButton
              icon={<AlignJustify size={16} />}
              active={isAlignJustify}
              onClick={() => setAlignment('justify')}
              title="Justifier"
            />
          </div>
        </div>

        {/* First Line Indent - Editable */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Retrait 1ère ligne</label>
            {hasFirstLineIndentOverride && (
              <button
                onClick={() => resetToTemplate('firstLineIndent')}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
                title="Revenir à la valeur du template"
              >
                <RotateCcw size={10} />
              </button>
            )}
          </div>
          <div className="relative">
            <select
              className={cn(
                "w-full px-3 py-1.5 pr-8 text-sm rounded border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
                hasFirstLineIndentOverride
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:border-primary/50"
              )}
              value={effectiveTypography.firstLineIndent}
              onChange={(e) => handleFirstLineIndentChange(e.target.value)}
            >
              {FIRST_LINE_INDENTS.map(indent => (
                <option key={indent.value} value={indent.value}>
                  {indent.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Line Spacing - Editable */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Interligne</label>
            {hasLineHeightOverride && (
              <button
                onClick={() => resetToTemplate('lineHeight')}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
                title="Revenir à la valeur du template"
              >
                <RotateCcw size={10} />
              </button>
            )}
          </div>
          <div className="relative">
            <select
              className={cn(
                "w-full px-3 py-1.5 pr-8 text-sm rounded border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
                hasLineHeightOverride
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:border-primary/50"
              )}
              value={effectiveTypography.lineHeight}
              onChange={(e) => handleLineHeightChange(parseFloat(e.target.value))}
            >
              {LINE_HEIGHTS.map(lh => (
                <option key={lh.value} value={lh.value}>
                  {lh.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Page Format Section - Locked */}
      <section>
        <div className="flex items-center gap-1 mb-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Format de page
          </h3>
          <Lock size={10} className="text-muted-foreground" />
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-sm font-medium mb-1">{currentTemplate.name}</div>
          <div className="text-xs text-muted-foreground">{currentTemplate.description}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Page: {currentTemplate.page.width} × {currentTemplate.page.height}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 italic">
          Changez le format via le sélecteur dans la barre d'outils.
        </p>
      </section>

      {/* Margins Section */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Marges
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <MarginDisplay label="Haut" value={currentTemplate.page.marginTop} />
          <MarginDisplay label="Bas" value={currentTemplate.page.marginBottom} />
          <MarginDisplay label="Gauche" value={currentTemplate.page.marginLeft} />
          <MarginDisplay label="Droite" value={currentTemplate.page.marginRight} />
        </div>
      </section>

      {/* Typography Summary */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Typographie effective
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Police</span>
            <span className="font-medium">{effectiveTypography.fontFamily.split(',')[0]}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Taille</span>
            <span className={cn("font-medium", hasFontSizeOverride && "text-primary")}>
              {effectiveTypography.fontSize}
              {hasFontSizeOverride && <span className="text-muted-foreground ml-1">({currentTemplate.typography.fontSize})</span>}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Interligne</span>
            <span className={cn("font-medium", hasLineHeightOverride && "text-primary")}>
              {effectiveTypography.lineHeight}
              {hasLineHeightOverride && <span className="text-muted-foreground ml-1">({currentTemplate.typography.lineHeight})</span>}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Retrait</span>
            <span className={cn("font-medium", hasFirstLineIndentOverride && "text-primary")}>
              {effectiveTypography.firstLineIndent}
              {hasFirstLineIndentOverride && <span className="text-muted-foreground ml-1">({currentTemplate.typography.firstLineIndent})</span>}
            </span>
          </div>
        </div>

        {(hasFontSizeOverride || hasLineHeightOverride || hasFirstLineIndentOverride) && (
          <p className="text-xs text-muted-foreground mt-3 italic">
            Les valeurs en couleur ont été modifiées. La valeur du template est entre parenthèses.
          </p>
        )}
      </section>
    </div>
  )
}

interface FormatButtonProps {
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
}

function FormatButton({ icon, active, onClick, title }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-2 rounded transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
    </button>
  )
}

interface MarginDisplayProps {
  label: string
  value: string
}

function MarginDisplay({ label, value }: MarginDisplayProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded border border-input bg-background">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  )
}
