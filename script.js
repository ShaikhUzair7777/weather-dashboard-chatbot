const container = document.querySelector(".container")
const search = document.querySelector(".search-btn")
const weatherBox = document.querySelector(".weather-box")
const weatherDetails = document.querySelector(".weather-details")
const image = document.querySelector(".weather-box img")
const temperature = document.querySelector(".weather-box .temperature")
const description = document.querySelector(".weather-box .description")
const locationName = document.querySelector(".weather-box .location-name")
const humidity = document.querySelector(".weather-details .humidity .text span")
const wind = document.querySelector(".weather-details .wind .text span")
const errorMessage = document.querySelector(".error-message")
const currentLocationBtn = document.querySelector(".current-location-btn")
const forecastContainer = document.querySelector(".forecast-container")

// NOTE: API key removed from client-side for security.
// Weather requests are proxied through a Netlify function at /.netlify/functions/weather

function displayDefaultWeather() {
  if (image) image.src = "https://img.icons8.com/?size=100&id=1AfLv3KbfVba&format=png&color=000000"
  if (temperature) temperature.innerHTML = "0 <span class='celcius-icon'>°C</span>"
  if (description) description.innerHTML = "Partly Cloudy"
  if (locationName) locationName.innerHTML = "Search for a city"
  if (humidity) humidity.innerHTML = "0%"
  if (wind) wind.innerHTML = "0 Km/h"
  if (errorMessage) errorMessage.style.display = "none"
}

// Initialize default weather and chatbot on page load
displayDefaultWeather();

// Chatbot UI is initialized centrally in chatbot.js via window.initializeChatbot()
// Call the centralized initializer if available (deferred script ensures chatbot.js loads first)
if (window.initializeChatbot) window.initializeChatbot();

if (search) {
  search.addEventListener("click", () => {
    const cityInput = document.querySelector(".search-box input")
    if (!cityInput) return

    const city = cityInput.value.trim()

    if (city === "") {
      if (errorMessage) errorMessage.style.display = "none"
      return
    }

    fetchWeatherData(city)
    cityInput.value = "" // Clear input after search
  })
}

const searchInput = document.querySelector(".search-box input")
if (searchInput) {
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const city = searchInput.value.trim()
      if (city !== "") {
        fetchWeatherData(city)
        searchInput.value = "" // Clear input after search
      }
    }
  })
}

if (currentLocationBtn) {
  // Ensure only one icon is present and prevent double icons
  currentLocationBtn.innerHTML = ""
  const icon = document.createElement("i")
  icon.className = "bx bx-current-location"
  currentLocationBtn.appendChild(icon)

  currentLocationBtn.addEventListener("click", async () => {
    currentLocationBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>'
    currentLocationBtn.disabled = true

    try {
      const pos = await getCurrentPositionSafe({ timeout: 10000 });
      if (pos && pos.lat && pos.lon) {
        fetchWeatherByCoords(pos.lat, pos.lon)
      } else {
        alert('Unable to determine location. Please enter a city manually.');
      }
    } catch (err) {
      alert(err.message || 'Unable to retrieve your location. Please enter a city manually.');
    } finally {
      setTimeout(() => {
        currentLocationBtn.innerHTML = ""
        const icon = document.createElement("i")
        icon.className = "bx bx-current-location"
        currentLocationBtn.appendChild(icon)
        currentLocationBtn.disabled = false
      }, 800)
    }
  })
}

/**
 * getCurrentPositionSafe: Attempts browser geolocation first (with Permissions API if available),
 * falls back to IP-based lookup if denied/unavailable.
 * Returns { lat, lon } or throws an Error with a friendly message.
 */
function getCurrentPositionSafe(options = {}) {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      // If Permissions API is available, check status for better messaging
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
          if (perm.state === 'denied') {
                // Fallback to server-side IP lookup via our Netlify function to avoid CORS/rate-limit issues
                fetch('/.netlify/functions/weather?ipgeo=1')
                  .then(res => res.json())
                  .then(data => {
                    if (data && (data.lat || data.lon)) {
                      resolve({ lat: parseFloat(data.lat), lon: parseFloat(data.lon) })
                    } else {
                      reject(new Error('Location access denied. Please enter city manually.'))
                    }
                  })
                  .catch(() => reject(new Error('Unable to determine location. Please enter city manually.')))
          } else {
            // Ask for position
            navigator.geolocation.getCurrentPosition(
              (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
              (e) => {
                switch (e.code) {
                  case e.PERMISSION_DENIED:
                    reject(new Error('Location permission denied. Please enter a city manually.'))
                    break
                  case e.POSITION_UNAVAILABLE:
                    reject(new Error('Location information is unavailable.'))
                    break
                  case e.TIMEOUT:
                    reject(new Error('Location request timed out.'))
                    break
                  default:
                    reject(new Error('Unable to get your location.'))
                }
              },
              options
            )
          }
        }).catch(() => {
          // Could not query permissions, just try geolocation
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
            (e) => reject(new Error('Unable to get your location.')),
            options
          )
        })
      } else {
        // No Permissions API
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          (e) => reject(new Error('Unable to get your location.')),
          options
        )
      }
    } else {
      reject(new Error('Geolocation is not supported by this browser'))
    }
  })
}

// Ensure helper is available on window for other scripts
try {
  if (typeof window !== 'undefined' && typeof getCurrentPositionSafe === 'function') {
    window.getCurrentPositionSafe = getCurrentPositionSafe
  }
} catch (e) {
  // ignore
}

function fetchWeatherByCoords(lat, lon) {
  // Fetch current weather
  // Use server-side proxy to avoid exposing API key
  fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
    .then((response) => response.json())
    .then((json) => {
      if (json && (json.cod === 200 || json.cod === '200')) {
        displayCurrentWeather(json)
        // Fetch forecast data through proxy
        fetchForecastByCoords(lat, lon)
      } else {
        showError()
      }
    })
    .catch((error) => {
      console.error("Error fetching weather:", error)
      showError()
    })
}

function fetchWeatherData(city) {
  // Fetch current weather
  // Proxy through serverless function to keep API key on the server
  fetch(`/.netlify/functions/weather?city=${encodeURIComponent(city)}`)
    .then((response) => response.json())
    .then((json) => {
      if (json && (json.cod === 200 || json.cod === '200')) {
        displayCurrentWeather(json)
        // Fetch forecast via proxy
        fetchForecastData(city)
      } else if (json && (json.cod === 404 || json.cod === '404')) {
        showError()
      } else {
        showError()
      }
    })
    .catch((error) => {
      console.error("Error fetching weather:", error)
      showError()
    })
}

function displayCurrentWeather(json) {
  console.log("[v0] Weather data received:", json.weather[0])
  console.log("[v0] Precipitation data:", json.rain || json.snow || "No precipitation")

  if (image) image.src = getWeatherImage(json.weather[0].main)
  if (temperature) temperature.innerHTML = `${Math.round(json.main.temp)} <span class="celcius-icon">°C</span>`
  if (description) {
    let weatherDesc = json.weather[0].description
    // Add precipitation details if available
    if (json.rain && json.rain["1h"]) {
      weatherDesc += ` (${json.rain["1h"]}mm/h)`
    } else if (json.snow && json.snow["1h"]) {
      weatherDesc += ` (${json.snow["1h"]}mm/h)`
    }
    description.innerHTML = weatherDesc
  }
  if (locationName) locationName.innerHTML = `${json.name}, ${json.sys.country}`
  if (humidity) humidity.innerHTML = `${json.main.humidity}%`
  if (wind) wind.innerHTML = `${Math.round(json.wind.speed)} Km/h`
  if (errorMessage) errorMessage.style.display = "none"

  const precipitationElement = document.querySelector(".weather-details .precipitation .text span")
  if (precipitationElement) {
    if (json.rain && json.rain["1h"]) {
      precipitationElement.innerHTML = `${json.rain["1h"]}mm/h`
    } else if (json.snow && json.snow["1h"]) {
      precipitationElement.innerHTML = `${json.snow["1h"]}mm/h`
    } else {
      precipitationElement.innerHTML = "0mm/h"
    }
  }
}

function fetchForecastData(city) {
  fetch(`/.netlify/functions/weather?city=${encodeURIComponent(city)}&forecast=1`)
    .then((response) => response.json())
    .then((json) => {
      if (json && (json.cod === 200 || json.cod === '200' || json.list)) {
        displayForecast(json)
      }
    })
    .catch((error) => {
      console.error("Error fetching forecast:", error)
    })
}

function fetchForecastByCoords(lat, lon) {
  fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&forecast=1`)
    .then((response) => response.json())
    .then((json) => {
      if (json && (json.cod === 200 || json.cod === '200' || json.list)) {
        displayForecast(json)
      }
    })
    .catch((error) => {
      console.error("Error fetching forecast:", error)
    })
}

function displayForecast(json) {
  const forecastItems = document.querySelectorAll(".forecast-item")
  if (!forecastItems.length) return

  const dailyForecasts = []
  const usedDays = new Set()
  // Group forecasts by day (API returns 3-hour intervals)
  for (let i = 0; i < json.list.length && dailyForecasts.length < 5; i++) {
    const forecast = json.list[i]
    const forecastDate = new Date(forecast.dt * 1000)
    const forecastDay = forecastDate.getDate()
    if (!usedDays.has(forecastDay)) {
      dailyForecasts.push(forecast)
      usedDays.add(forecastDay)
    }
  }
  // If less than 5, fill with last available
  while (dailyForecasts.length < 5 && json.list.length) {
    dailyForecasts.push(json.list[json.list.length - 1])
  }

  dailyForecasts.forEach((forecast, index) => {
    if (index < forecastItems.length) {
      const item = forecastItems[index]
      const date = new Date(forecast.dt * 1000)
      const dayName =
        index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-US", { weekday: "short" })

      const dayElement = item.querySelector(".forecast-day")
      const iconElement = item.querySelector(".forecast-icon")
      const tempElement = item.querySelector(".forecast-temp")
      const descElement = item.querySelector(".forecast-desc")

      if (dayElement) dayElement.textContent = dayName
      if (iconElement) iconElement.src = getWeatherImage(forecast.weather[0].main)
      if (tempElement) tempElement.textContent = `${Math.round(forecast.main.temp)}°`
      if (descElement) descElement.textContent = forecast.weather[0].description
    }
  })
}

function showError() {
  if (errorMessage) {
    errorMessage.style.display = "block"
    errorMessage.innerHTML = '<i class="bx bx-error"></i> City not found. Please try again.'
  }
  if (image) image.src = "https://img.icons8.com/?size=100&id=4cwci9UBLc5x&format=png&color=000000"
  if (temperature) temperature.innerHTML = "0 <span class='celcius-icon'>°C</span>"
  if (description) description.innerHTML = "City not found"
  if (locationName) locationName.innerHTML = ""
  if (humidity) humidity.innerHTML = "0%"
  if (wind) wind.innerHTML = "0 Km/h"
}

function getWeatherImage(weather) {
  console.log("[v0] Weather condition:", weather)

  switch (weather) {
    case "Clear":
      return "https://img.icons8.com/?size=120&id=7UYg9itOH2r7&format=png&color=FFD700"
    case "Rain":
      return "https://img.icons8.com/?size=120&id=ESeqfDjC5eVO&format=png&color=4A90E2"
    case "Snow":
      return "https://img.icons8.com/?size=120&id=OHFGSKIiCM0B&format=png&color=87CEEB"
    case "Clouds":
      return "https://img.icons8.com/?size=120&id=mD5PxYIC4jJB&format=png&color=708090"
    case "Mist":
      return "https://cdn-icons-png.flaticon.com/512/4005/4005817.png"
    case "Fog":
      return "https://tse4.mm.bing.net/th/id/OIP.j-8s35qU1ARGnY_jkR55NwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
    case "Haze":
      return "https://png.pngtree.com/png-vector/20220621/ourmid/pngtree-daytime-foggy-weather-clouds-illustration-png-image_5246770.png"
    case "Thunderstorm":
      return "https://img.icons8.com/?size=120&id=59878&format=png&color=4B0082"
    case "Drizzle":
      return "https://img.icons8.com/?size=120&id=59877&format=png&color=6495ED"
    default:
      console.log("[v0] Unknown weather condition, using default icon")
      return "https://img.icons8.com/?size=120&id=1AfLv3KbfVba&format=png&color=FFA500"
  }
}

function updateCurrentTime() {
  const currentTimeElement = document.getElementById("currentTime")
  const currentDateElement = document.getElementById("currentDate")

  if (currentTimeElement && currentDateElement) {
    const now = new Date()

    // Format time (12-hour format with AM/PM)
    const timeString = now.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    // Format date with full day name, month name, and year
    const dateString = now.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })

    currentTimeElement.textContent = timeString
    currentDateElement.textContent = dateString
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateCurrentTime()
  setInterval(updateCurrentTime, 1000)
})
