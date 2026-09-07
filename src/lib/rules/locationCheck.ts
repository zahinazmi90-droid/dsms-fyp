import { getSetting } from "@/lib/settings";
import { haversineDistanceMeters } from "@/lib/geo";

export type LocationCheckResult = { ok: true } | { ok: false; error: string };

/**
 * Verifies the student's device is within the configured radius of campus,
 * using GPS coordinates supplied by the browser (navigator.geolocation) --
 * never IP address. IP address was deliberately NOT used for this: the
 * guard post has no WiFi and students check out over their own mobile data
 * (per the original field interview), so IP addresses do not reliably
 * correspond to physical location for this system's real usage pattern.
 *
 * This is a strong deterrent against remote/off-campus check-ins, not a
 * guarantee against account sharing between two people who are both
 * genuinely on campus -- that is a social/trust problem no client-side
 * signal can fully solve. Combine with guard/warden spot checks for that.
 */
export async function verifyCampusLocation(params: {
  latitude: number | undefined;
  longitude: number | undefined;
}): Promise<LocationCheckResult> {
  const enabled = await getSetting<boolean>("location_verification_enabled");
  if (!enabled) return { ok: true };

  if (params.latitude === undefined || params.longitude === undefined) {
    return {
      ok: false,
      error: "Sila benarkan akses lokasi (GPS) pada telefon anda untuk meneruskan KELUAR/MASUK.",
    };
  }

  const campusLat = await getSetting<number>("campus_latitude");
  const campusLon = await getSetting<number>("campus_longitude");
  const radiusMeters = await getSetting<number>("campus_radius_meters");

  const distance = haversineDistanceMeters(params.latitude, params.longitude, campusLat, campusLon);

  if (distance > radiusMeters) {
    return {
      ok: false,
      error: `Anda berada di luar kawasan kampus yang dibenarkan (anggaran ${Math.round(
        distance
      )}m dari kampus). Sila cuba semula apabila berada di dalam kawasan kampus.`,
    };
  }

  return { ok: true };
}
