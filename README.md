Weather Pro 🚀
Weather Pro is an optimized full-stack weather webapp featuring an intelligent chatbot, real-time forecasts, geolocation, and air quality data. Deployed on Netlify with secure serverless functions proxying OpenWeatherMap API calls.​

✨ Key Features
AI-Powered Chatbot: Natural language weather queries with conversation history

Safe Geolocation: Permissions API + IP fallback for denied access

Real-time Data: Current weather, 5-day forecasts, air quality index

Pexels Video Background: Optimized with preload, overlay, and slow-motion effects

Netlify Functions: Secure API proxy hiding OpenWeatherMap key​

Mobile-First Design: Glassmorphism UI, ARIA accessibility, focus management

🛠 Tech Stack
Frontend	Backend	Deployment	APIs
HTML5, CSS3, Vanilla JS	Netlify Functions (JS)	Netlify CDN	OpenWeatherMap
ARIA a11y, Permissions API	Serverless Proxy	Static Hosting	Geocoding/Forecast
📱 Live Demo
https://shaikhuzairwebapp.netlify.app/

Try: "What's the weather in Mumbai?" or allow location for current forecast.​

🚀 Recent Optimizations
Replaced background video with Pexels URL + playsinline/preload/overlay

Centralized chatbot init in chatbot.js (idempotent, no duplicates)

Added getCurrentPositionSafe() with Permissions API + IP fallback

Accessibility: ARIA labels, aria-live chat updates, rel="noopener"

Performance: Deferred scripts, CSS overlays, video optimization

Security: Netlify Functions proxy at /netlify/functions/weather​

Files Updated: index.html, search.html, chatbot.js, script.js, homepage.js, CSS files, README.md

🔧 Deployment Guide
Push to GitHub repo

Netlify: "New site from Git" → Connect repo → Build command: "" → Publish: ./

Add env var: OPENWEATHER_API_KEY in Site settings → Environment variables

Deploy! Client calls secure endpoints like /.netlify/functions/weather?city=London​

API Endpoints:

text
GET /.netlify/functions/weather?city=London (current)
GET /.netlify/functions/weather?city=London&forecast=1 (5-day)
GET /.netlify/functions/weather?lat=...&lon=... (coords)
GET /.netlify/functions/weather?geocode=1&city=... (geocode)

📈 Performance & Lighthouse
Optimized for 90+ scores: deferred JS, video preload, minimal CSS, responsive design.​

⚠️ Security Notes
Client-side calls proxy only—no direct OpenWeatherMap exposure

netlify/functions/weather.js handles all weather/geocode/forecast​

Security note: Keep your API key in environment variables and never commit it to the repository.


