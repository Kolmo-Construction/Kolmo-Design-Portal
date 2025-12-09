// server/services/geofencing.service.ts

/**
 * Geofencing Service
 * Provides GPS distance calculations and geofence validation for time tracking and location-based features
 */

export interface GeofenceValidationResult {
  withinGeofence: boolean;
  distanceMeters: number;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters

  return distance;
}

/**
 * Check if coordinates are within geofence threshold
 * Default threshold: 100 meters
 *
 * @param userLat - User's latitude
 * @param userLon - User's longitude
 * @param projectLat - Project's latitude
 * @param projectLon - Project's longitude
 * @param thresholdMeters - Maximum distance in meters (default: 100)
 * @returns Object with withinGeofence boolean and distance in meters
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  projectLat: number,
  projectLon: number,
  thresholdMeters: number = 100
): GeofenceValidationResult {
  const distance = calculateDistance(userLat, userLon, projectLat, projectLon);

  return {
    withinGeofence: distance <= thresholdMeters,
    distanceMeters: distance,
  };
}

/**
 * Validate coordinates are valid GPS values
 *
 * @param latitude - Latitude to validate
 * @param longitude - Longitude to validate
 * @returns True if coordinates are valid
 */
export function areValidCoordinates(
  latitude: number,
  longitude: number
): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
