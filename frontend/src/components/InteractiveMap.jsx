import React from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// We need to fix the default icon issue in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

const markers = [
  { code: 'INK', name: 'Bangalore Province', position: [12.9716, 77.5946] },
  { code: 'INM', name: 'Chennai Province', position: [13.0827, 80.2707] },
  { code: 'IND', name: 'Dimapur Province', position: [25.9060, 93.7259] },
  { code: 'ING', name: 'Guwahati Province', position: [26.1445, 91.7362] },
  { code: 'INH', name: 'Hyderabad Province', position: [17.3850, 78.4867] },
  { code: 'INC', name: 'Kolkata Province', position: [22.5726, 88.3639] },
  { code: 'INB', name: 'Mumbai Province', position: [19.0760, 72.8777] },
  { code: 'INN', name: 'New Delhi Province', position: [28.6139, 77.2090] },
  { code: 'INP', name: 'Panjim Province', position: [15.4909, 73.8278] },
  { code: 'INS', name: 'Shillong Province', position: [25.5788, 91.8933] },
  { code: 'INT', name: 'Tiruchy Province', position: [10.7905, 78.7047] },
  { code: 'LKC', name: 'Sri Lanka Vice Province', position: [7.8731, 80.7718] },
]

export function InteractiveMap({ className, dragging = true }) {
  // Center roughly on South Asia
  const center = [20.0, 80.0]
  const zoom = 5

  return (
    <div className={`w-full h-full relative z-0 ${className || ''}`}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={dragging}
        dragging={dragging}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.code} position={m.position}>
            <Popup>
              <div className="font-sans">
                <strong className="text-sdb-blue-deep block text-sm">{m.name}</strong>
                <span className="text-xs text-mid uppercase tracking-wide">Code: {m.code}</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
