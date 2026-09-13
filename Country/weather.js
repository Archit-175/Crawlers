// Credentials stay on the server. Static-only hosting reports availability honestly.
async function fetchWeather(index) {
  const location = locations[index];
  const container = document.querySelectorAll('.weather-info')[index];
  if (!location || !container) return;
  try {
    const response = await fetch(`/api/weather?lat=${location.lat}&lon=${location.lon}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    container.replaceChildren(...[
      `Temperature: ${data.main.temp}°C`,
      `Weather: ${data.weather[0].main}`,
      `Humidity: ${data.main.humidity}%`
    ].map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
  } catch { container.textContent = 'Live weather unavailable'; }
}
if (typeof locations !== 'undefined') locations.forEach((_, index) => fetchWeather(index));
