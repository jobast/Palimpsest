import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { Icon, LatLng } from 'leaflet'
import { Search, MapPin, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface Coordinates {
  latitude: number
  longitude: number
}

interface MapPickerProps {
  coordinates?: Coordinates
  zoom?: number
  onChange: (coords: Coordinates, zoom: number) => void
  className?: string
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
}

// Component to handle map click events
function MapClickHandler({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    }
  })
  return null
}

// Component to handle map moves and update center
function MapMoveHandler({ onMove }: { onMove: (center: LatLng, zoom: number) => void }) {
  const map = useMap()

  useMapEvents({
    moveend() {
      onMove(map.getCenter(), map.getZoom())
    }
  })
  return null
}

// Component to fly to new location
function FlyToLocation({ center, zoom }: { center: LatLng | null; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1 })
    }
  }, [center, zoom, map])

  return null
}

export function MapPicker({ coordinates, zoom = 13, onChange, className }: MapPickerProps) {
  const [markerPosition, setMarkerPosition] = useState<LatLng | null>(
    coordinates ? new LatLng(coordinates.latitude, coordinates.longitude) : null
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(zoom)
  const [flyToCenter, setFlyToCenter] = useState<LatLng | null>(null)

  // Default center: Paris, France
  const defaultCenter = new LatLng(48.8566, 2.3522)
  const initialCenter = coordinates
    ? new LatLng(coordinates.latitude, coordinates.longitude)
    : defaultCenter

  const handleMapClick = useCallback((latlng: LatLng) => {
    setMarkerPosition(latlng)
    onChange(
      { latitude: latlng.lat, longitude: latlng.lng },
      currentZoom
    )
  }, [onChange, currentZoom])

  const handleMapMove = useCallback((_center: LatLng, newZoom: number) => {
    setCurrentZoom(newZoom)
    if (markerPosition) {
      onChange(
        { latitude: markerPosition.lat, longitude: markerPosition.lng },
        newZoom
      )
    }
  }, [markerPosition, onChange])

  // Search for addresses using Nominatim
  const searchAddress = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'fr'
          }
        }
      )
      const results = await response.json()
      setSearchResults(results)
      setShowResults(true)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 3) {
        searchAddress(searchQuery)
      } else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, searchAddress])

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const newPosition = new LatLng(lat, lng)

    setMarkerPosition(newPosition)
    setFlyToCenter(newPosition)
    setShowResults(false)
    setSearchQuery(result.display_name.split(',')[0])

    onChange({ latitude: lat, longitude: lng }, currentZoom)
  }

  const clearMarker = () => {
    setMarkerPosition(null)
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search bar */}
      <div className="relative mb-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un lieu..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-[1000] w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelectResult(result)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map container */}
      <div className="flex-1 rounded-lg overflow-hidden border border-border relative">
        <MapContainer
          center={initialCenter}
          zoom={zoom}
          className="h-full w-full"
          style={{ minHeight: '300px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapMoveHandler onMove={handleMapMove} />
          {flyToCenter && <FlyToLocation center={flyToCenter} zoom={currentZoom} />}
          {markerPosition && (
            <Marker position={markerPosition} icon={defaultIcon} />
          )}
        </MapContainer>
      </div>

      {/* Coordinates display */}
      {markerPosition && (
        <div className="mt-3 flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-primary" />
            <span className="font-mono text-xs">
              {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
            </span>
          </div>
          <button
            onClick={clearMarker}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Supprimer le marqueur"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {!markerPosition && (
        <p className="mt-3 text-sm text-muted-foreground text-center">
          Cliquez sur la carte pour placer un marqueur
        </p>
      )}
    </div>
  )
}
