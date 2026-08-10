import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface PickedLocation {
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
}

interface Props {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
}

// Abuja default centre
const DEFAULT_CENTER = { lat: 9.0765, lng: 7.3986 };
const MAPS_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

declare global {
  interface Window {
    google?: typeof google;
    __tropicsMapsReady?: Promise<void>;
    __tropicsInitMaps?: () => void;
  }
}

const loadMaps = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.maps) return Promise.resolve();
  if (window.__tropicsMapsReady) return window.__tropicsMapsReady;
  if (!MAPS_KEY) return Promise.reject(new Error('Maps key missing'));

  window.__tropicsMapsReady = new Promise<void>((resolve, reject) => {
    window.__tropicsInitMaps = () => resolve();
    const s = document.createElement('script');
    const channel = CHANNEL ? `&channel=${encodeURIComponent(CHANNEL)}` : '';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&loading=async&libraries=places&callback=__tropicsInitMaps${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return window.__tropicsMapsReady;
};

export default function DeliveryLocationPicker({ value, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState(value?.address ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; primary: string; secondary: string }>>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);

  const updateLocation = useCallback(
    async (lat: number, lng: number, forcedAddress?: string) => {
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      let address = forcedAddress ?? '';
      if (!address && geocoderRef.current) {
        try {
          const res = await geocoderRef.current.geocode({ location: { lat, lng } });
          address = res.results?.[0]?.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        } catch {
          address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
      }
      setManualAddress(address);
      onChange({ address, lat, lng, mapsUrl });
    },
    [onChange],
  );

  // Load Maps + build the map
  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current || !window.google?.maps) return;
        const center = value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER;
        const map = new window.google.maps.Map(mapDivRef.current, {
          center,
          zoom: value ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        const marker = new window.google.maps.Marker({
          map,
          position: center,
          draggable: true,
        });
        marker.addListener('dragend', () => {
          const p = marker.getPosition();
          if (p) updateLocation(p.lat(), p.lng());
        });
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          updateLocation(e.latLng.lat(), e.latLng.lng());
        });
        mapRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = new window.google.maps.Geocoder();
        sessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch((e) => {
        console.warn('[map picker]', e);
        setError('Map could not load. Please type your address below.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (!ready || !searchQuery.trim() || searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const q = searchQuery.trim();
    let cancelled = false;
    setSearchingPlaces(true);
    const t = setTimeout(async () => {
      try {
        const places = (await window.google!.maps.importLibrary('places')) as google.maps.PlacesLibrary;
        const { suggestions: preds } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: sessionRef.current ?? undefined,
          includedRegionCodes: ['ng'],
        });
        if (cancelled) return;
        setSuggestions(
          preds
            .map((s) => s.placePrediction)
            .filter((p): p is google.maps.places.PlacePrediction => !!p)
            .slice(0, 5)
            .map((p) => ({
              placeId: p.placeId,
              primary: p.mainText?.toString() ?? p.text.toString(),
              secondary: p.secondaryText?.toString() ?? '',
            })),
        );
      } catch (e) {
        console.warn('[places autocomplete]', e);
      } finally {
        if (!cancelled) setSearchingPlaces(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, ready]);

  const pickSuggestion = async (placeId: string, label: string) => {
    if (!window.google?.maps) return;
    try {
      const places = (await window.google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
      const place = new places.Place({ id: placeId });
      await place.fetchFields({ fields: ['location', 'formattedAddress'] });
      const loc = place.location;
      if (!loc) return;
      const lat = loc.lat();
      const lng = loc.lng();
      if (mapRef.current) {
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(17);
      }
      if (markerRef.current) markerRef.current.setPosition({ lat, lng });
      updateLocation(lat, lng, place.formattedAddress ?? label);
      setSearchQuery('');
      setSuggestions([]);
      sessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch (e) {
      console.warn('[place details]', e);
    }
  };

  // Fallback: no maps key or load failed → plain input behaviour
  if (!MAPS_KEY || error) {
    return (
      <div className="space-y-2">
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Input
          placeholder="Street, area, city, landmark"
          value={manualAddress}
          onChange={(e) => {
            const v = e.target.value;
            setManualAddress(v);
            if (v.trim().length >= 5) {
              onChange({ address: v, lat: 0, lng: 0, mapsUrl: '' });
            } else {
              onChange(null);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={searchRef}
          placeholder="Search your address or landmark"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-8"
        />
        {searchingPlaces && (
          <Loader2 className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {suggestions.length > 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-border/60 bg-popover shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onClick={() => pickSuggestion(s.placeId, `${s.primary}, ${s.secondary}`)}
                className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border/40 last:border-b-0"
              >
                <div className="text-sm font-medium">{s.primary}</div>
                {s.secondary && <div className="text-[11px] text-muted-foreground">{s.secondary}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={mapDivRef}
        className="w-full h-64 rounded-lg overflow-hidden border border-border/40 bg-muted"
      />
      {value ? (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs">
          <div className="flex items-start gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="break-words">{value.address}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground pl-5">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Search, click the map, or drag the pin to set your delivery location.
        </p>
      )}
    </div>
  );
}
