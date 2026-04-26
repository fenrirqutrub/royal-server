// royal-server/src/utils/ipLocation.js

/**
 * IP থেকে location বের করো — ip-api.com (free, no key needed)
 * Rate limit: 45 req/min — যথেষ্ট login/signup এর জন্য
 * কোনো error হলে empty object return করবে — কখনো throw করবে না
 */
export const getLocationFromIP = async (ip) => {
  const empty = {
    city: null,
    region: null,
    country: null,
    countryCode: null,
    lat: null,
    lon: null,
    timezone: null,
    isp: null,
    org: null,
    as: null,
    query: ip ?? null,
  };

  try {
    if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168")) {
      return { ...empty, city: "localhost", country: "Local" };
    }

    // Clean IP (remove ::ffff: prefix)
    const cleanIP = ip.replace(/^::ffff:/, "");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(
      `http://ip-api.com/json/${cleanIP}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return empty;

    const data = await res.json();
    if (data.status !== "success") return empty;

    return {
      city: data.city ?? null,
      region: data.regionName ?? null,
      country: data.country ?? null,
      countryCode: data.countryCode ?? null,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      timezone: data.timezone ?? null,
      isp: data.isp ?? null,
      org: data.org ?? null,
      as: data.as ?? null,
      query: data.query ?? cleanIP,
    };
  } catch {
    return empty;
  }
};
