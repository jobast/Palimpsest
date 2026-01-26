import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { getPageDimensions } from '@/lib/pagination'
import { parseFontSize, convertToPixels } from '@/lib/pagination/unitConversions'
import {
  FileText,
  Users,
  MapPin,
  GitBranch,
  StickyNote,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  LayoutGrid,
  Globe,
  Pencil,
  Copy,
  Trash2,
  CheckCircle,
  Clock,
  FileCheck,
  Map,
  Bot,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ManuscriptItem, LocationSheet, CharacterSheet, PlotSheet, AIReport } from '@shared/types/project'
import { useState } from 'react'
import { GlobalMapView } from '../maps/GlobalMapView'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut
} from '../ui/ContextMenu'

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel } = useUIStore()

  return (
    <div className="h-full flex flex-col">
      {/* Panel tabs */}
      <div className="flex border-b border-border">
        <SidebarTab
          icon={<FileText size={16} />}
          label="Manuscrit"
          active={sidebarPanel === 'project'}
          onClick={() => setSidebarPanel('project')}
        />
        <SidebarTab
          icon={<Users size={16} />}
          label="Fiches"
          active={sidebarPanel === 'sheets'}
          onClick={() => setSidebarPanel('sheets')}
        />
        <SidebarTab
          icon={<LayoutGrid size={16} />}
          label="Pages"
          active={sidebarPanel === 'pages'}
          onClick={() => setSidebarPanel('pages')}
        />
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {sidebarPanel === 'project' && <ManuscriptPanel />}
        {sidebarPanel === 'pages' && <PageThumbnailsPanel />}
        {sidebarPanel === 'sheets' && <SheetsPanel />}
      </div>
    </div>
  )
}

function SidebarTab({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors',
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}

function ManuscriptPanel() {
  const {
    project,
    activeDocumentId,
    setActiveDocument,
    addManuscriptItem,
    updateManuscriptItem,
    deleteManuscriptItem,
    duplicateManuscriptItem
  } = useProjectStore()

  if (!project) return null

  const handleAddChapter = () => {
    addManuscriptItem({
      id: crypto.randomUUID(),
      type: 'chapter',
      title: `Chapitre ${project.manuscript.items.length + 1}`,
      status: 'draft',
      wordCount: 0,
      children: []
    })
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Manuscrit
        </span>
        <button
          onClick={handleAddChapter}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Ajouter un chapitre"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-0.5">
        {project.manuscript.items.map((item) => (
          <ManuscriptTreeItem
            key={item.id}
            item={item}
            activeId={activeDocumentId}
            onSelect={setActiveDocument}
            onUpdate={updateManuscriptItem}
            onDelete={deleteManuscriptItem}
            onDuplicate={duplicateManuscriptItem}
            onAddChild={addManuscriptItem}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}

function ManuscriptTreeItem({
  item,
  activeId,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddChild,
  depth
}: {
  item: ManuscriptItem
  activeId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, updates: Partial<ManuscriptItem>) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onAddChild: (item: ManuscriptItem, parentId?: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(item.title)
  const hasChildren = item.children && item.children.length > 0

  const icon = item.type === 'folder' ? <Folder size={14} /> : <FileText size={14} />

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== item.title) {
      onUpdate(item.id, { title: renameValue.trim() })
    }
    setIsRenaming(false)
  }

  const handleAddScene = () => {
    onAddChild({
      id: crypto.randomUUID(),
      type: 'scene',
      title: `Scene ${(item.children?.length || 0) + 1}`,
      status: 'draft',
      wordCount: 0
    }, item.id)
  }

  const statusIcons = {
    draft: <Clock size={12} className="text-muted-foreground" />,
    revision: <Pencil size={12} className="text-yellow-500" />,
    final: <FileCheck size={12} className="text-green-500" />
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => onSelect(item.id)}
            className={cn(
              'w-full flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors',
              activeId === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-accent'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {hasChildren && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(!expanded)
                }}
                className="p-0.5 hover:bg-accent rounded cursor-pointer"
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            )}
            {!hasChildren && <span className="w-4" />}
            {icon}
            {isRenaming ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') {
                    setRenameValue(item.title)
                    setIsRenaming(false)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="flex-1 bg-background border border-border rounded px-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <span className="truncate flex-1 text-left">{item.title}</span>
            )}
            {!isRenaming && (
              <>
                {statusIcons[item.status]}
                <span className="text-xs text-muted-foreground">{item.wordCount}</span>
              </>
            )}
          </button>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => setIsRenaming(true)}>
            <Pencil size={14} className="mr-2" />
            Renommer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate(item.id)}>
            <Copy size={14} className="mr-2" />
            Dupliquer
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <CheckCircle size={14} className="mr-2" />
              Statut
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => onUpdate(item.id, { status: 'draft' })}>
                <Clock size={14} className="mr-2" />
                Brouillon
                {item.status === 'draft' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onUpdate(item.id, { status: 'revision' })}>
                <Pencil size={14} className="mr-2" />
                Revision
                {item.status === 'revision' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onUpdate(item.id, { status: 'final' })}>
                <FileCheck size={14} className="mr-2" />
                Final
                {item.status === 'final' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          {item.type === 'chapter' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleAddScene}>
                <Plus size={14} className="mr-2" />
                Ajouter une scene
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => onDelete(item.id)}
            destructive
          >
            <Trash2 size={14} className="mr-2" />
            Supprimer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <ManuscriptTreeItem
              key={child.id}
              item={child}
              activeId={activeId}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SheetsPanel() {
  const {
    project,
    addSheet,
    activeSheetId,
    setActiveSheet,
    activeReportId,
    setActiveReport,
    deleteReport,
    updateSheet,
    deleteSheet,
    duplicateSheet
  } = useProjectStore()
  const [showGlobalMap, setShowGlobalMap] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (!project) return null

  // Count locations with coordinates
  const locationsWithCoords = project.sheets.locations.filter(l => l.coordinates)
  const hasGeoLocations = locationsWithCoords.length > 0

  const createSheet = (type: 'character' | 'location' | 'plot' | 'note') => {
    const now = new Date().toISOString()
    const baseSheet = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }

    let newSheet
    switch (type) {
      case 'character':
        newSheet = {
          ...baseSheet,
          type: 'character' as const,
          name: 'Nouveau personnage',
          role: 'secondary' as const,
          description: '',
        }
        break
      case 'location':
        newSheet = {
          ...baseSheet,
          type: 'location' as const,
          name: 'Nouveau lieu',
          description: '',
        }
        break
      case 'plot':
        newSheet = {
          ...baseSheet,
          type: 'plot' as const,
          name: 'Nouvelle intrigue',
          plotType: 'subplot' as const,
          description: '',
        }
        break
      case 'note':
        newSheet = {
          ...baseSheet,
          type: 'note' as const,
          name: 'Nouvelle note',
          content: '',
        }
        break
    }

    addSheet(newSheet)
    setActiveSheet(newSheet.id)
  }

  const sheetCategories = [
    {
      key: 'characters' as const,
      type: 'character' as const,
      label: 'Personnages',
      icon: <Users size={14} />,
      items: project.sheets.characters,
      extraButton: null
    },
    {
      key: 'locations' as const,
      type: 'location' as const,
      label: 'Lieux',
      icon: <MapPin size={14} />,
      items: project.sheets.locations,
      extraButton: hasGeoLocations ? (
        <button
          onClick={() => setShowGlobalMap(true)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary"
          title="Voir la carte globale"
        >
          <Globe size={14} />
        </button>
      ) : null
    },
    {
      key: 'plots' as const,
      type: 'plot' as const,
      label: 'Intrigues',
      icon: <GitBranch size={14} />,
      items: project.sheets.plots,
      extraButton: null
    },
    {
      key: 'notes' as const,
      type: 'note' as const,
      label: 'Notes',
      icon: <StickyNote size={14} />,
      items: project.sheets.notes,
      extraButton: null
    }
  ]

  return (
    <div className="p-2 space-y-4">
      {sheetCategories.map((cat) => {
        const isCollapsed = collapsedCategories.has(cat.key)
        return (
        <div key={cat.key}>
          <div className="flex items-center justify-between px-2 mb-1">
            <button
              onClick={() => toggleCategory(cat.key)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {cat.icon}
              <span>{cat.label}</span>
              <span className="text-[10px]">({cat.items.length})</span>
            </button>
            <div className="flex items-center gap-1">
              {cat.extraButton}
              <button
                onClick={() => createSheet(cat.type)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title={`Ajouter ${cat.label.toLowerCase()}`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {!isCollapsed && (cat.items.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6 py-1 italic">
              Aucun {cat.label.toLowerCase()}
            </p>
          ) : (
            <div className="space-y-1">
              {cat.items.map((sheet) => {
                // Check if this is a location with coordinates
                const isGeolocated = cat.type === 'location' && (sheet as LocationSheet).coordinates
                const characterSheet = cat.type === 'character' ? sheet as CharacterSheet : null
                const plotSheet = cat.type === 'plot' ? sheet as PlotSheet : null
                const locationSheet = cat.type === 'location' ? sheet as LocationSheet : null

                return (
                  <ContextMenu key={sheet.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        onClick={() => setActiveSheet(sheet.id)}
                        className={cn(
                          'w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded text-sm transition-colors text-left',
                          activeSheetId === sheet.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-accent'
                        )}
                      >
                        <FileText size={12} className="text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{sheet.name}</span>
                        {isGeolocated && (
                          <span title="Geolocalisee">
                            <MapPin size={10} className="text-primary shrink-0" />
                          </span>
                        )}
                      </button>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onClick={() => duplicateSheet(sheet.id)}>
                        <Copy size={14} className="mr-2" />
                        Dupliquer
                      </ContextMenuItem>

                      {/* Character-specific options */}
                      {characterSheet && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuSub>
                            <ContextMenuSubTrigger>
                              <Users size={14} className="mr-2" />
                              Role
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { role: 'protagonist' })}>
                                Protagoniste
                                {characterSheet.role === 'protagonist' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { role: 'antagonist' })}>
                                Antagoniste
                                {characterSheet.role === 'antagonist' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { role: 'secondary' })}>
                                Secondaire
                                {characterSheet.role === 'secondary' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { role: 'minor' })}>
                                Mineur
                                {characterSheet.role === 'minor' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
                              </ContextMenuItem>
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                        </>
                      )}

                      {/* Location-specific options */}
                      {locationSheet && (
                        <>
                          <ContextMenuSeparator />
                          {locationSheet.coordinates ? (
                            <>
                              <ContextMenuItem onClick={() => {
                                setActiveSheet(sheet.id)
                              }}>
                                <Map size={14} className="mr-2" />
                                Voir sur la carte
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { coordinates: undefined, mapZoom: undefined })}>
                                <MapPin size={14} className="mr-2" />
                                Effacer coordonnees
                              </ContextMenuItem>
                            </>
                          ) : (
                            <ContextMenuItem onClick={() => setActiveSheet(sheet.id)}>
                              <MapPin size={14} className="mr-2" />
                              Ajouter coordonnees
                            </ContextMenuItem>
                          )}
                        </>
                      )}

                      {/* Plot-specific options */}
                      {plotSheet && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuSub>
                            <ContextMenuSubTrigger>
                              <GitBranch size={14} className="mr-2" />
                              Type
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { plotType: 'main' })}>
                                Intrigue principale
                                {plotSheet.plotType === 'main' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => updateSheet(sheet.id, { plotType: 'subplot' })}>
                                Intrigue secondaire
                                {plotSheet.plotType === 'subplot' && <ContextMenuShortcut>✓</ContextMenuShortcut>}
                              </ContextMenuItem>
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                        </>
                      )}

                      <ContextMenuSeparator />

                      <ContextMenuItem
                        onClick={() => deleteSheet(sheet.id)}
                        destructive
                      >
                        <Trash2 size={14} className="mr-2" />
                        Supprimer
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
            </div>
          ))}
        </div>
      )})}


      {/* AI Reports Section */}
      {project.reports.length > 0 && (
        <>
          <div className="border-t border-border my-3" />
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bot size={14} />
                <span>Rapports IA</span>
                <span className="text-[10px]">({project.reports.length})</span>
              </div>
            </div>

            <div className="space-y-0.5">
              {project.reports.map((report) => (
                <ReportListItem
                  key={report.id}
                  report={report}
                  isActive={activeReportId === report.id}
                  onSelect={() => setActiveReport(report.id)}
                  onDelete={() => deleteReport(report.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Global Map Modal */}
      {showGlobalMap && (
        <GlobalMapView onClose={() => setShowGlobalMap(false)} />
      )}
    </div>
  )
}

function ReportListItem({
  report,
  isActive,
  onSelect,
  onDelete
}: {
  report: AIReport
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const reportTypeLabels: Record<string, string> = {
    'character-analysis': 'Personnage',
    'plot-analysis': 'Intrigue',
    'editorial-feedback': 'Editorial',
    'timeline': 'Timeline',
    'consistency-check': 'Coherence',
    'translation': 'Traduction'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            'w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded text-sm transition-colors text-left',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-foreground hover:bg-accent'
          )}
        >
          <Sparkles size={12} className="text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{report.title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatDate(report.createdAt)}
          </span>
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem disabled>
          <Bot size={14} className="mr-2" />
          {reportTypeLabels[report.type] || report.type}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} destructive>
          <Trash2 size={14} className="mr-2" />
          Supprimer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// StatsPanel is now imported from @/components/stats

/**
 * Page Thumbnails Panel
 * Shows miniature previews of pages for quick navigation with real text content
 */
function PageThumbnailsPanel() {
  const { pages, currentPage, totalPages } = usePaginationStore()
  const { editor, currentTemplate, getEffectiveTypography } = useEditorStore()

  // Get actual page dimensions from template (properly converted to pixels)
  const dims = getPageDimensions(currentTemplate)

  // Get effective typography (template + user overrides)
  const typography = getEffectiveTypography()

  // Calculate thumbnail dimensions maintaining correct aspect ratio
  const maxThumbnailWidth = 176 // Sidebar width minus padding
  const aspectRatio = dims.height / dims.width
  const thumbnailWidth = maxThumbnailWidth
  const thumbnailHeight = thumbnailWidth * aspectRatio

  // Calculate content area dimensions
  const contentAreaWidth = thumbnailWidth -
    (dims.marginLeft / dims.width) * thumbnailWidth -
    (dims.marginRight / dims.width) * thumbnailWidth

  // Calculate scale factor: thumbnail content width / actual page content width
  const scaleFactor = contentAreaWidth / dims.contentWidth

  // Scale typography values
  const scaledFontSize = parseFontSize(typography.fontSize) * scaleFactor
  const scaledFirstLineIndent = convertToPixels(typography.firstLineIndent) * scaleFactor

  // Extract text content for a specific page
  const getPageText = (pageNumber: number): string => {
    if (!editor) return ''
    try {
      // Get all text from the editor (excludes header/footer decorations)
      const fullText = editor.state.doc.textContent

      if (!fullText || totalPages <= 0) return ''

      // Calculate start position based on page number
      const estimatedCharsPerPage = Math.ceil(fullText.length / totalPages)
      const startIndex = (pageNumber - 1) * estimatedCharsPerPage

      // Return plenty of text to fill the thumbnail (overflow will be hidden)
      // Use 5000 chars or remaining text, whichever is smaller
      return fullText.slice(startIndex, startIndex + 5000).trim()
    } catch {
      return ''
    }
  }

  const scrollToPage = (pageNum: number) => {
    window.dispatchEvent(
      new CustomEvent('palimpseste:scrollToPage', { detail: { page: pageNum } })
    )
  }

  if (pages.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Aucune page à afficher
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pages ({totalPages})
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        {pages.map((pageInfo) => {
          const pageText = getPageText(pageInfo.pageNumber)

          return (
            <button
              key={pageInfo.pageNumber}
              onClick={() => scrollToPage(pageInfo.pageNumber)}
              className={cn(
                'rounded-lg border-2 transition-all overflow-hidden bg-paper',
                currentPage === pageInfo.pageNumber
                  ? 'border-primary shadow-md'
                  : 'border-border hover:border-muted-foreground/50'
              )}
              style={{
                width: `${thumbnailWidth}px`,
                height: `${thumbnailHeight}px`,
              }}
            >
              {/* Thumbnail content */}
              <div
                className="relative w-full h-full overflow-hidden"
              >
                {/* Scaled text content - padding proportional to page margins + header/footer */}
                <div
                  className="absolute text-paper-foreground overflow-hidden"
                  style={{
                    top: `${((dims.marginTop + dims.headerHeight) / dims.height) * thumbnailHeight}px`,
                    left: `${(dims.marginLeft / dims.width) * thumbnailWidth}px`,
                    right: `${(dims.marginRight / dims.width) * thumbnailWidth}px`,
                    bottom: `${((dims.marginBottom + dims.footerHeight) / dims.height) * thumbnailHeight}px`,
                    fontSize: `${Math.max(2, scaledFontSize)}px`,
                    lineHeight: typography.lineHeight,
                    fontFamily: typography.fontFamily,
                    textAlign: 'justify',
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                    textIndent: `${scaledFirstLineIndent}px`,
                  }}
                >
                  {pageText || (
                    <span className="text-muted-foreground/30 italic" style={{ textIndent: 0 }}>Page vide</span>
                  )}
                </div>

                {/* Page number badge */}
                <div className="absolute bottom-1 right-1 bg-background/80 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {pageInfo.pageNumber}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
