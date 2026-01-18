import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Icon, LatLngBounds, LatLng } from 'leaflet'
import { useProjectStore } from '@/stores/projectStore'
import type { LocationSheet } from '@shared/types/project'
import { X, MapPin, ExternalLink } from 'lucide-react'

// Fix for default marker icon in webpack/vite
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

interface GlobalMapViewProps {
  onClose: () => void
}

// Component to fit bounds to all markers
function FitBounds({ locations }: { locations: LocationSheet[] }) {
  const map = useMap()

  useEffect(() => {
    const locationsWithCoords = locations.filter(l => l.coordinates)
    if (locationsWithCoords.length === 0) return

    if (locationsWithCoords.length === 1) {
      const loc = locationsWithCoords[0]
      map.setView(
        [loc.coordinates!.latitude, loc.coordinates!.longitude],
        13
      )
    } else {
      const bounds = new LatLngBounds(
        locationsWithCoords.map(l => [l.coordinates!.latitude, l.coordinates!.longitude])
      )
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, map])

  return null
}

export function GlobalMapView({ onClose }: GlobalMapViewProps) {
  const { project, setActiveSheet } = useProjectStore()

  // Get all locations with coordinates
  const locationsWithCoords = useMemo(() => {
    if (!project) return []
    return project.sheets.locations.filter(l => l.coordinates)
  }, [project])

  // Default center: Paris, France (or first location with coords)
  const defaultCenter = useMemo(() => {
    if (locationsWithCoords.length > 0) {
      const first = locationsWithCoords[0]
      return new LatLng(first.coordinates!.latitude, first.coordinates!.longitude)
    }
    return new LatLng(48.8566, 2.3522)
  }, [locationsWithCoords])

  const handleOpenSheet = (location: LocationSheet) => {
    setActiveSheet(location.id)
    onClose()
  }

  const totalLocations = project?.sheets.locations.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-6xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <MapPin size={24} className="text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Carte des Lieux</h2>
              <p className="text-sm text-muted-foreground">
                {locationsWithCoords.length} lieu{locationsWithCoords.length !== 1 ? 'x' : ''} geolocalisee{locationsWithCoords.length !== 1 ? 's' : ''} sur {totalLocations}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {locationsWithCoords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MapPin size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun lieu geolocalisee</p>
              <p className="text-sm mt-2">
                Ajoutez des coordonnees a vos fiches de lieu pour les voir sur la carte
              </p>
            </div>
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={6}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds locations={locationsWithCoords} />

              {locationsWithCoords.map((location) => (
                <Marker
                  key={location.id}
                  position={[location.coordinates!.latitude, location.coordinates!.longitude]}
                  icon={defaultIcon}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-semibold text-sm mb-1">{location.name}</h3>
                      {location.description && (
                        <p
                          className="text-xs text-muted-foreground line-clamp-3 mb-2"
                          dangerouslySetInnerHTML={{
                            __html: location.description.replace(/<[^>]*>/g, ' ').slice(0, 150)
                          }}
                        />
                      )}
                      <button
                        onClick={() => handleOpenSheet(location)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink size={12} />
                        Ouvrir la fiche
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Location list sidebar */}
        {locationsWithCoords.length > 0 && (
          <div className="border-t border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Lieux sur la carte
            </p>
            <div className="flex flex-wrap gap-2">
              {locationsWithCoords.map((location) => (
                <button
                  key={location.id}
                  onClick={() => handleOpenSheet(location)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full border border-border hover:border-primary hover:text-primary transition-colors text-sm"
                >
                  <MapPin size={12} />
                  {location.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
