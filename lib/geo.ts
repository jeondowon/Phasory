// 위치 유틸 — 소리 지도용. 위치의 단일 소스는 사람이 읽는 라벨이고, 핀 좌표(lat/lng)는
// 그 라벨에서 파생한다(EDIT에서 라벨을 바꾸면 forward-geocode로 핀이 따라 이동).
import * as Location from 'expo-location';

export type GeoPoint = { lat: number; lng: number };
export type GeoFix = GeoPoint & { label: string };

// reverse-geocode 결과에서 "도시 · 구" 라벨을 만든다. 지역마다 채워지는 필드가 달라
// 큰 단위(city/region) → 작은 단위(district/name) 순으로 비어있지 않고 중복 아닌 둘만 고른다.
function formatLabel(a: Location.LocationGeocodedAddress): string {
  const primary = a.city ?? a.region ?? a.subregion ?? undefined;
  const secondary = a.district ?? a.subregion ?? a.name ?? undefined;
  const parts = [primary, secondary].filter(
    (v, i, arr): v is string => !!v && arr.indexOf(v) === i
  );
  return parts.join(' · ') || 'Unknown';
}

// 현재 위치를 가져와 라벨까지 만든다. 권한 거부·실패 시 null(저장은 막지 않음).
export async function getCurrentLocation(): Promise<GeoFix | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let label = 'Unknown';
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addr) label = formatLabel(addr);
    } catch {
      // reverse-geocode 실패해도 좌표는 유효하므로 라벨만 기본값으로 둔다.
    }
    return { lat, lng, label };
  } catch {
    return null;
  }
}

// 지도 초기 카메라용 — 현재 위치 좌표만 빠르게(라벨/reverse-geocode 없이). 권한 거부·실패 시 null.
export async function getCurrentCoords(): Promise<GeoPoint | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

// 라벨 텍스트 → 좌표. EDIT에서 라벨이 바뀌었을 때 핀을 옮기는 데 쓴다.
// "City · District" 형태의 가운뎃점은 지오코더가 못 읽으므로 콤마로 바꿔 질의한다.
export async function geocodeLabel(label: string): Promise<GeoPoint | null> {
  const query = label.replace(/\s*·\s*/g, ', ').trim();
  if (!query) return null;
  try {
    const [hit] = await Location.geocodeAsync(query);
    if (!hit) return null;
    return { lat: hit.latitude, lng: hit.longitude };
  } catch {
    return null;
  }
}

// 저장 시점에 라벨 텍스트로 최종 위치를 확정한다(ADD·EDIT 공용).
//  - 라벨이 비면 위치 없음(지도 핀 안 생김)
//  - 라벨이 기존과 같으면 좌표 유지(불필요한 지오코딩·드리프트 회피)
//  - 라벨이 바뀌었으면 forward-geocode로 좌표 갱신, 실패하면 기존 좌표에 새 라벨만
export async function resolveLocation(
  label: string,
  current?: GeoFix
): Promise<GeoFix | undefined> {
  const trimmed = label.trim();
  if (!trimmed) return undefined;
  if (current && current.label === trimmed) return current;
  const pt = await geocodeLabel(trimmed);
  if (pt) return { ...pt, label: trimmed };
  if (current) return { ...current, label: trimmed };
  return undefined;
}
