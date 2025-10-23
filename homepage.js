
const featuredCities = ["New York", "London", "Tokyo", "Dubai", "Jeddah", "Sydney", "Paris", "Mumbai", "Singapore"]

function createCityCard(cityData) {
  const card = document.createElement("div")
  card.className = "city-card"
  card.style.animationDelay = `${Math.random() * 0.5}s`

  const isDay = new Date().getHours() >= 6 && new Date().getHours() < 18
  const weatherIcon = getWeatherIcon(cityData.weather[0].main, isDay)

  const feelsLike = Math.round(cityData.main.feels_like)
  const temp = Math.round(cityData.main.temp)

  card.innerHTML = `
        <div class="card-header">
            <h3>${cityData.name}</h3>
            <span class="country">${cityData.sys.country}</span>
        </div>
        <div class="weather-main">
            <div class="weather-icon">${weatherIcon}</div>
            <div class="temperature-section">
                <div class="temperature">${temp}°</div>
                <div class="feels-like">Feels like ${feelsLike}°</div>
            </div>
        </div>
        <div class="weather-description">${cityData.weather[0].description}</div>
        <div class="weather-details">
            <div class="detail-item">
                <i class='bx bx-droplet'></i>
                <span class="detail-label">Humidity</span>
                <span class="detail-value">${cityData.main.humidity}%</span>
            </div>
            <div class="detail-item">
                <i class='bx bx-wind'></i>
                <span class="detail-label">Wind</span>
                <span class="detail-value">${Math.round(cityData.wind.speed)} km/h</span>
            </div>
            <div class="detail-item">
                <i class='bx bx-tachometer'></i>
                <span class="detail-label">Pressure</span>
                <span class="detail-value">${cityData.main.pressure} hPa</span>
            </div>
            <div class="detail-item">
                <i class='bx bx-show'></i>
                <span class="detail-label">Visibility</span>
                <span class="detail-value">${cityData.visibility ? Math.round(cityData.visibility / 1000) : "N/A"} km</span>
            </div>
        </div>
    `

  return card
}

function getWeatherIcon(weather, isDay = true) {
  const iconMap = {
    Clear: isDay ? "☀️" : "🌙",
    Rain: "🌧️",
    Snow: "❄️",
    Clouds: "☁️",
    Mist: "🌫️",
    Fog: "🌫️",
    Thunderstorm: "⛈️",
    Drizzle: "🌦️",
    Haze: "🌫️",
  }

  return iconMap[weather] || "🌤️"
}

async function fetchCityWeather(city) {
  try {
    // Proxy the request to keep API key server-side
    const response = await fetch(`/.netlify/functions/weather?city=${encodeURIComponent(city)}`)
    const data = await response.json()
    // Accept both numeric and string codes from API
    if (data && (data.cod === 200 || data.cod === '200')) return data
    return null
  } catch (error) {
    console.error(`Error fetching weather for ${city}:`, error)
    return null
  }
}

// Chatbot UI is initialized centrally in chatbot.js via window.initializeChatbot()

async function initializeHomepage() {
  const cityGrid = document.getElementById("cityGrid")

  if (!cityGrid) {
    console.error("City grid element not found")
    return
  }
  
  // Initialize chatbot UI (centralized in chatbot.js)
  if (window.initializeChatbot) window.initializeChatbot();

  cityGrid.innerHTML =
    '<div class="loading"><i class="bx bx-loader-alt bx-spin"></i><span>Loading weather data...</span></div>'

  await getUserLocationWeather()

  try {
    const weatherPromises = featuredCities.map((city) => fetchCityWeather(city))
    const weatherData = await Promise.all(weatherPromises)

    cityGrid.innerHTML = ""
    weatherData.forEach((data) => {
      if (data) {
        const card = createCityCard(data)
        cityGrid.appendChild(card)
      }
    })

    updateLastUpdatedTime()
  } catch (error) {
    console.error("Error initializing homepage:", error)
    cityGrid.innerHTML =
      '<div class="error-message"><i class="bx bx-error"></i><p>Error loading weather data. Please try again later.</p></div>'
  }
}

async function getUserLocationWeather() {
  const userLocationElement = document.getElementById("userLocation")

  if (!userLocationElement) {
    console.error("User location element not found")
    return
  }

  userLocationElement.textContent = "Getting location..."

  // Prefer shared helper if available (defined in script.js)
  const getPos = window.getCurrentPositionSafe || (opts => new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Geolocation not supported'))
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej, opts)
  }))

  try {
    const position = await getPos({ timeout: 10000 })
    try {
      const { latitude: lat, longitude: lon } = { latitude: position.lat, longitude: position.lon }
      // Proxy through serverless function to avoid exposing API key
      const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
      const data = await response.json()

      if (data.cod === 200) {
        userLocationElement.textContent = `${data.name}, ${data.sys.country} (${Math.round(data.main.temp)}°C)`
      } else {
        userLocationElement.textContent = "Location unavailable"
      }
    } catch (error) {
      console.error("Error fetching user location weather:", error)
      userLocationElement.textContent = "Location unavailable"
    }
  } catch (err) {
    // Friendly error messages
    userLocationElement.textContent = err.message || 'Location access denied'
  }
}

function updateLastUpdatedTime() {
  const lastUpdatedElement = document.getElementById("lastUpdated")

  if (!lastUpdatedElement) {
    console.error("Last updated element not found")
    return
  }

  const now = new Date()
  const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  lastUpdatedElement.textContent = timeString
}

function updateCurrentTime() {
  const currentTimeElement = document.getElementById("currentTime")

  if (currentTimeElement) {
    const now = new Date()
    const timeString = now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    currentTimeElement.textContent = timeString
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeHomepage()
  updateCurrentTime()
  setInterval(updateCurrentTime, 1000)
})

setInterval(initializeHomepage, 300000)
