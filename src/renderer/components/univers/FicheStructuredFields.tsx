import { MapPicker } from '../maps/MapPicker'
import type { Fiche } from '@shared/wiki'

interface Props {
  fiche: Fiche
  onChange: (meta: Record<string, unknown>) => void
}

function setMeta(fiche: Fiche, key: string, value: unknown): Record<string, unknown> {
  const meta = { ...(fiche.meta ?? {}) }
  if (value === undefined || value === '' || value === null) delete meta[key]
  else meta[key] = value
  return meta
}

/** Category-specific structured fields, read/written into fiche.meta. */
export function FicheStructuredFields({ fiche, onChange }: Props) {
  const meta = fiche.meta ?? {}

  if (fiche.category === 'lieux') {
    const coords = meta.coordinates as { latitude: number; longitude: number } | undefined
    const zoom = typeof meta.mapZoom === 'number' ? meta.mapZoom : 13
    return (
      <div className="space-y-2 p-3 border-b border-border">
        <MapPicker
          coordinates={coords}
          zoom={zoom}
          onChange={(c, z) => onChange({ ...setMeta(fiche, 'coordinates', c), mapZoom: z })}
          className="h-48 rounded"
        />
        <input
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
          placeholder="Importance narrative…"
          value={(meta.significance as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'significance', e.target.value))}
        />
        <textarea
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm resize-none"
          rows={2}
          placeholder="Détails sensoriels…"
          value={(meta.sensoryDetails as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'sensoryDetails', e.target.value))}
        />
      </div>
    )
  }

  if (fiche.category === 'personnages') {
    const roles = ['protagonist', 'antagonist', 'secondary', 'minor'] as const
    return (
      <div className="space-y-2 p-3 border-b border-border">
        <select
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
          value={(meta.role as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'role', e.target.value))}
        >
          <option value="">(rôle…)</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
          placeholder="Apparence physique…"
          value={(meta.physicalDescription as string) ?? ''}
          onChange={e => onChange(setMeta(fiche, 'physicalDescription', e.target.value))}
        />
      </div>
    )
  }

  return null
}
