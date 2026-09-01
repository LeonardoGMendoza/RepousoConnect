import React, { useEffect, useRef, useState, useMemo } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ── Map style ────────────────────────────────────────────────────────────────
// CARTO Voyager: estilo colorido, gratuito, oficialmente liberado para uso em
// qualquer app (com atribuição), e funciona igual em iOS, Android e Desktop.
// Isso elimina o "hack" que trocava para tiles feios no iPhone e o risco de
// usar os tiles internos do Waze (que não são uma API pública oficial).
const MAP_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
};

const UserMarkerIcon = ({ invisible, bearing = 0, navMode }) => (
  invisible ? (
    <div className="waze-ghost" style={{transform: 'scale(0.9)'}}>
      <div className="waze-ghost-wheel-left"></div>
      <div className="waze-ghost-wheel-right"></div>
      <div className="waze-ghost-face">
        <div className="waze-ghost-eyes">
          <div className="waze-ghost-eye"></div>
          <div className="waze-ghost-eye"></div>
        </div>
        <div className="waze-ghost-mouth">
          <div className="waze-ghost-tongue"></div>
        </div>
      </div>
    </div>
  ) : navMode ? (
    // Seta de direção estilo Waze durante a navegação
    <div style={{
      width: 0, height: 0,
      borderLeft: '14px solid transparent',
      borderRight: '14px solid transparent',
      borderBottom: '28px solid #2563EB',
      filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.4))',
      transform: `rotate(${bearing}deg)`,
      transition: 'transform 0.3s ease'
    }} />
  ) : (
    <div className="custom-red-pin">
      <div className="custom-red-pin-inner">
        <div className="red-pin-cross"></div>
        <div className="red-pin-eyes">
          <div className="red-pin-eye"></div>
          <div className="red-pin-eye"></div>
        </div>
        <div className="red-pin-smile"></div>
      </div>
    </div>
  )
);

const FacilityMarkerIcon = ({ color }) => (
  <div style={{
    width: 32, height: 32, background: color, border: '3px solid #fff',
    borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
    boxShadow: '0 4px 12px rgba(0,0,0,.3)'
  }}>
    <div style={{
      width: 12, height: 12, background: '#fff', borderRadius: '50%',
      position: 'absolute', top: 7, left: 7
    }}></div>
  </div>
);

const DestinationMarkerIcon = ({ color }) => (
  <div style={{
    width: 48, height: 48, background: color, border: '4px solid #fff',
    borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
    boxShadow: '0 6px 16px rgba(0,0,0,.4)', zIndex: 10
  }}>
    <div style={{
      width: 16, height: 16, background: '#fff', borderRadius: '50%',
      position: 'absolute', top: 12, left: 12
    }}></div>
  </div>
);

// Calcula o rumo (bearing) entre dois pontos, pra seta apontar na direção certa
function calcBearing(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const MapComponent = ({
  userLocation,
  facilities,
  activeFacility,
  onFacilitySelect,
  onMapMove,
  getTypeColor,
  navMode,
  routeCoords,
  invisible
}) => {
  const mapRef = useRef();

  const defaultCenter = { longitude: -46.4496, latitude: -23.5413, zoom: 13, pitch: 45, bearing: 0 };
  const [viewState, setViewState] = useState(defaultCenter);

  // Rumo do usuário até o destino, pra rotacionar a seta e a câmera (visual tipo Waze)
  const bearing = useMemo(() => {
    if (!navMode || !userLocation || !activeFacility) return 0;
    return calcBearing(userLocation.lat, userLocation.lon, activeFacility.lat, activeFacility.lon);
  }, [navMode, userLocation, activeFacility]);

  // Centraliza no usuário quando a localização chega (fora do modo navegação)
  useEffect(() => {
    if (userLocation && !navMode) {
      setViewState(prev => ({
        ...prev,
        longitude: userLocation.lon,
        latitude: userLocation.lat,
        zoom: 14.5,
        pitch: 60,
        transitionDuration: 1000
      }));
    }
  }, [userLocation, navMode]);

  // No modo navegação: câmera "voa" pra trás do usuário, olhando na direção do destino,
  // igual ao Waze. Só mexemos na câmera quando o mapa realmente terminou de
  // carregar o estilo — chamar easeTo/fitBounds antes disso é o que travava o mapa.
  useEffect(() => {
    if (!navMode || !userLocation || !mapRef.current) return;

    const map = mapRef.current.getMap();

    const moveCamera = () => {
      try {
        if (activeFacility && routeCoords && routeCoords.length > 0) {
          // Mostra a rota inteira rapidinho...
          const bounds = new maplibregl.LngLatBounds(
            [userLocation.lon, userLocation.lat],
            [userLocation.lon, userLocation.lat]
          );
          bounds.extend([activeFacility.lon, activeFacility.lat]);
          routeCoords.forEach(c => bounds.extend([c[0], c[1]]));
          map.fitBounds(bounds, { padding: 80, pitch: 0, bearing: 0, duration: 1000 });
        } else {
          // ...senão, já vai direto pra visão de navegação
          map.easeTo({ center: [userLocation.lon, userLocation.lat], zoom: 17, pitch: 65, bearing, duration: 1000 });
        }
      } catch (err) {
        console.error('Erro ao mover câmera:', err);
      }
    };

    if (map.isStyleLoaded()) {
      moveCamera();
    } else {
      map.once('load', moveCamera);
    }
  }, [navMode, userLocation, activeFacility, routeCoords, bearing]);

  // Depois que a rota aparece, espera um instante mostrando o trajeto inteiro
  // e então muda pra visão "atrás do usuário" (chase cam), tipo Waze.
  useEffect(() => {
    if (!navMode || !userLocation || !mapRef.current || !routeCoords) return;
    const map = mapRef.current.getMap();
    const t = setTimeout(() => {
      if (!map.isStyleLoaded()) return;
      try {
        map.easeTo({ center: [userLocation.lon, userLocation.lat], zoom: 17, pitch: 65, bearing, duration: 1500 });
      } catch (err) {
        console.error('Erro ao mover câmera (chase cam):', err);
      }
    }, 1800);
    return () => clearTimeout(t);
  }, [navMode, routeCoords]); // eslint-disable-line react-hooks

  // Prepare Route GeoJSON
  const routeData = useMemo(() => {
    if (!routeCoords || routeCoords.length === 0) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoords // OSRM with geometries=geojson returns [lon, lat] natively
      }
    };
  }, [routeCoords]);

  const onMoveEnd = (e) => {
    setViewState(e.viewState);
    if (onMapMove) onMapMove({ lat: e.viewState.latitude, lon: e.viewState.longitude });
  };

  return (
    <div className="map-area">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onMoveEnd={onMoveEnd}
        mapStyle={MAP_STYLE}
        mapLib={maplibregl}
        maxPitch={85}
        interactiveLayerIds={['facilities-layer']}
      >
        <NavigationControl position="top-right" showCompass={true} />

        {userLocation && (
          <Marker longitude={userLocation.lon} latitude={userLocation.lat} anchor="center" style={{ zIndex: 100 }}>
            <UserMarkerIcon invisible={invisible} bearing={bearing} navMode={navMode} />
          </Marker>
        )}

        {navMode && activeFacility && (
          <Marker longitude={activeFacility.lon} latitude={activeFacility.lat} anchor="bottom" style={{ zIndex: 90 }}>
            <DestinationMarkerIcon color={getTypeColor(activeFacility.type)} />
          </Marker>
        )}

        {!navMode && facilities.map(fac => (
          <Marker
            key={fac.id}
            longitude={fac.lon}
            latitude={fac.lat}
            anchor="bottom"
            onClick={e => { e.originalEvent.stopPropagation(); onFacilitySelect(fac); }}
          >
            <FacilityMarkerIcon color={getTypeColor(fac.type)} />
          </Marker>
        ))}

        {navMode && routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            <Layer
              id="route-line-bg"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#1d4ed8', 'line-width': 14, 'line-opacity': 0.25 }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#2563EB', 'line-width': 7 }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
};

export default MapComponent;
