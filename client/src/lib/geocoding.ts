// Geocoding utilities using OpenStreetMap Nominatim API

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
}

interface GeocodingResult {
  latitude: string;
  longitude: string;
  displayName: string;
}

/**
 * Geocodes an address using OpenStreetMap Nominatim API
 * @param address Full address string or address components
 * @returns GeocodingResult with latitude, longitude, and display name
 */
export async function geocodeAddress(
  address: string | {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }
): Promise<GeocodingResult | null> {
  try {
    let queryString: string;

    if (typeof address === 'string') {
      queryString = address;
    } else {
      // Build query from address components
      const parts = [
        address.street,
        address.city,
        address.state,
        address.zipCode
      ].filter(Boolean);
      queryString = parts.join(', ');
    }

    if (!queryString.trim()) {
      throw new Error('Address is required');
    }

    // Use OpenStreetMap Nominatim API
    // Documentation: https://nominatim.org/release-docs/latest/api/Search/
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', queryString);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', '1');
    url.searchParams.append('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Kolmo-Design-Portal/1.0', // Nominatim requires User-Agent
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.statusText}`);
    }

    const data: NominatimResponse[] = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      latitude: result.lat,
      longitude: result.lon,
      displayName: result.display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Validates if coordinates are within valid ranges
 */
export function isValidCoordinates(lat: string | number, lon: string | number): boolean {
  const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  const longitude = typeof lon === 'string' ? parseFloat(lon) : lon;

  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
