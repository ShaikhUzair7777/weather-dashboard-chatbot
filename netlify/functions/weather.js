// Netlify Function to proxy OpenWeatherMap requests and keep API key server-side
// Place this file under netlify/functions/weather.js
// Ensure you set OPENWEATHER_API_KEY in Netlify site settings (Environment Variables)

exports.handler = async function (event, context) {
  const qs = event.queryStringParameters || {};
  const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

  if (!OPENWEATHER_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server: OpenWeather API key not configured' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const base = 'https://api.openweathermap.org';
  try {
    // Geocoding direct
    if (qs.geocode === '1' && qs.city) {
      const city = encodeURIComponent(qs.city);
      const url = `${base}/geo/1.0/direct?q=${city}&limit=1&appid=${OPENWEATHER_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    // IP-based geolocation (use server-side lookup to get client's approximate location)
    if (qs.ipgeo === '1') {
      // Try to determine client IP from headers set by Netlify / proxies
      const headers = event.headers || {};
      let clientIp = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || headers['x-real-ip'];
      if (clientIp && clientIp.indexOf(',') !== -1) clientIp = clientIp.split(',')[0].trim();

      // Use ipapi.co which provides a simple JSON service; server-side fetch avoids CORS and rate-limit issues for clients
      const ipLookupUrl = clientIp ? `https://ipapi.co/${encodeURIComponent(clientIp)}/json/` : `https://ipapi.co/json/`;
      const resIp = await fetch(ipLookupUrl);
      const ipData = await resIp.json();
      // ipapi returns latitude/longitude
      if (ipData && (ipData.latitude || ipData.lat || ipData.loc)) {
        const lat = parseFloat(ipData.latitude || ipData.lat || (ipData.loc && ipData.loc.split(',')[0]));
        const lon = parseFloat(ipData.longitude || ipData.lon || (ipData.loc && ipData.loc.split(',')[1]));
        return { statusCode: 200, body: JSON.stringify({ lat, lon }), headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } };
      }
      return { statusCode: 502, body: JSON.stringify({ error: 'IP lookup failed' }), headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } };
    }

    // Reverse geocoding
    if (qs.reverse === '1' && qs.lat && qs.lon) {
      const lat = encodeURIComponent(qs.lat);
      const lon = encodeURIComponent(qs.lon);
      const url = `${base}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    // Air pollution
    if (qs.air === '1' && qs.lat && qs.lon) {
      const lat = encodeURIComponent(qs.lat);
      const lon = encodeURIComponent(qs.lon);
      const url = `${base}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    // OneCall (v3) - note: availability depends on API subscription
    if (qs.onecall === '1' && qs.lat && qs.lon) {
      const lat = encodeURIComponent(qs.lat);
      const lon = encodeURIComponent(qs.lon);
      const url = `${base}/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=current,hourly&appid=${OPENWEATHER_API_KEY}&units=metric`;
      const res = await fetch(url);
      const data = await res.json();
      return {
        statusCode: 200,
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    // Forecast (5 day / 3 hour)
    if (qs.forecast === '1') {
      if (qs.city) {
        const city = encodeURIComponent(qs.city);
        const url = `${base}/data/2.5/forecast?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } };
      }
      if (qs.lat && qs.lon) {
        const lat = encodeURIComponent(qs.lat);
        const lon = encodeURIComponent(qs.lon);
        const url = `${base}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } };
      }
    }

    // Current weather by city
    if (qs.city) {
      const city = encodeURIComponent(qs.city);
      const url = `${base}/data/2.5/weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } };
    }

    // Current weather by coords
    if (qs.lat && qs.lon) {
      const lat = encodeURIComponent(qs.lat);
      const lon = encodeURIComponent(qs.lon);
      const url = `${base}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid query' }), headers: { 'Content-Type': 'application/json' } };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }), headers: { 'Content-Type': 'application/json' } };
  }
};
