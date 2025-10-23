class WeatherChatbot {
    constructor() {
        this.name = "Weather Assistant";
        this.developer = {
            name: "Shaikh Uzair",
            linkedin: "https://www.linkedin.com/in/shaikh-uzair-353866313"
        };
        // API key intentionally not stored client-side. Serverless proxy (Netlify Functions) will use OPENWEATHER_API_KEY.
        this.apiKey = null;

        // Cache storage for data
        this.cache = {
            current: new Map(),
            forecast: new Map(),
            alerts: new Map(),
            airQuality: new Map(),
            lastUpdate: new Map()
        };

        // Cache duration in milliseconds (15 minutes)
        this.cacheDuration = 15 * 60 * 1000;

        // Local weather store
        this.weatherStore = {
            currentConditions: null,
            hourlyForecast: null,
            dailyForecast: null,
            weatherAlerts: null,
            airQuality: null,
            lastLocation: null
        };

        // Simple command patterns for quick matching
        this.commands = {
            greetings: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'hi there'],
            farewell: ['bye', 'goodbye', 'see you', 'take care', 'catch you later'],
            thanks: ['thank you', 'thanks', 'appreciate it', 'thx'],
            about: ['who are you', 'what are you', 'who made you', 'who created you', 'who is your developer', 'your developer'],
            help: ['help', 'what can you do', 'commands', 'features', 'options', 'assistance'],
            weather_current: ['weather in', 'current weather', 'how is the weather', 'temperature in'],
            weather_forecast: ['forecast', 'weather tomorrow', 'next few days', 'upcoming weather'],
            weather_details: ['humidity', 'wind speed', 'feels like', 'pressure', 'visibility'],
            weather_conditions: ['will it rain', 'is it sunny', 'is it cloudy', 'chance of rain'],
            weather_compare: ['compare weather', 'difference between', 'vs', 'versus'],
            weather_advice: ['what to wear', 'should i bring umbrella', 'clothing advice', 'weather tips'],
            weather_patterns: ['climate', 'seasonal', 'weather patterns', 'typical weather'],
            air_quality: ['air quality', 'pollution', 'aqi', 'air pollution index'],
            weather_alerts: ['alerts', 'warnings', 'severe weather', 'weather emergency'],
            weather_history: ['weather history', 'past weather', 'historical weather', 'weather records']
        };
        this.weatherKnowledge = {
            clothingAdvice: {
                hot: "Light, breathable clothing like cotton shirts, shorts, and sandals. Don't forget sunscreen and a hat! ☀️",
                warm: "Comfortable clothing like t-shirts and light pants. A light jacket for evening might be useful. 🌤️",
                mild: "Layered clothing works best - t-shirt with a light sweater or jacket you can remove if needed. 👕",
                cool: "Long sleeves, pants, and a medium jacket. Consider bringing a scarf for extra warmth. 🧥",
                cold: "Warm layers - thermal underwear, sweater, heavy coat, gloves, and warm boots. Stay cozy! 🧤",
                freezing: "Heavy winter clothing - insulated coat, warm hat, gloves, scarf, and waterproof boots. Layer up! ❄️"
            },
            weatherTips: {
                rain: "Carry an umbrella or raincoat. Wear waterproof shoes and drive carefully on wet roads. ☔",
                snow: "Wear warm, waterproof clothing. Drive slowly and allow extra time for travel. Clear snow from your car. ❄️",
                wind: "Secure loose items outdoors. Be cautious when driving, especially in high-profile vehicles. 💨",
                storm: "Stay indoors if possible. Avoid windows and seek shelter in a sturdy building. 🌩️",
                fog: "Use fog lights when driving. Reduce speed and increase following distance. Be extra cautious. 🌫️",
                heat: "Stay hydrated, seek shade, wear light colors, and avoid prolonged sun exposure. 🌡️"
            },
            climatePatterns: {
                spring: "Typically mild with increasing temperatures, occasional rain showers, and blooming vegetation. 🌸",
                summer: "Usually the warmest season with longer days, higher humidity, and potential for thunderstorms. ☀️",
                autumn: "Cooling temperatures, changing leaves, and more variable weather patterns. 🍂",
                winter: "Coldest season with shorter days, potential for snow/ice, and more stable weather patterns. ❄️"
            },
            airQualityInfo: {
                1: "Excellent - Air quality is ideal for outdoor activities. Perfect for exercise and spending time outside! 🌟",
                2: "Good - Air quality is acceptable. Great day for outdoor activities with minimal health concerns. ✅",
                3: "Moderate - Sensitive individuals may experience minor issues. Generally fine for most people. ⚠️",
                4: "Poor - Everyone may experience health effects. Consider limiting outdoor activities. 🚨",
                5: "Very Poor - Health alert! Avoid outdoor activities. Stay indoors with air purification if possible. 🔴"
            }
        };
    }

    // Helper function to get user's location with improved error handling
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation is not supported by your browser');
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            const successCallback = async (position) => {
                try {
                    // First, get coordinates
                    const coords = {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    };

                    // Then, try to get city name from reverse geocoding
                    // Use server-side proxy for reverse geocoding (keeps API key secure)
                    const response = await fetch(`/.netlify/functions/weather?reverse=1&lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`);
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }

                    const data = await response.json();
                    if (data && data.length > 0) {
                        coords.cityName = data[0].name;
                        coords.country = data[0].country;
                    }

                    resolve(coords);
                } catch (error) {
                    console.error('Error getting location details:', error);
                    resolve({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                }
            };

            const errorCallback = (error) => {
                let errorMessage;
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Please allow location access to get local weather information.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information is unavailable. Please try again later.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Location request timed out. Please check your internet connection.";
                        break;
                    default:
                        errorMessage = "An unknown error occurred getting your location.";
                }
                reject(new Error(errorMessage));
            };

            navigator.geolocation.getCurrentPosition(
                successCallback,
                errorCallback,
                options
            );
        });
    }

    // Helper function to check if text includes any of the patterns
    containsAny(text, patterns) {
        return patterns.some(pattern => 
            text.replace(/[^a-zA-Z0-9\s]/g, '')
                .split(' ')
                .some(word => 
                    pattern.replace(/[^a-zA-Z0-9\s]/g, '')
                        .split(' ')
                        .some(patternWord => 
                            this.levenshteinDistance(word, patternWord) <= Math.min(2, Math.floor(patternWord.length / 3))
                        )
                )
        );
    }

    // Levenshtein distance for fuzzy matching
    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = Array(b.length + 1).fill(null)
            .map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        return matrix[b.length][a.length];
    }

    async processMessage(message, location = '') {
        message = message.toLowerCase().trim();
        
        // Check for greetings
        if (this.containsAny(message, ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'])) {
            return this.getGreeting();
        }

        // Check for farewell
        if (this.containsAny(message, ['bye', 'goodbye', 'see you', 'take care'])) {
            return this.getFarewell();
        }

        // Check for thanks
        if (this.containsAny(message, ['thank', 'thanks', 'appreciate', 'thx'])) {
            return this.getThankYouResponse();
        }

        // Check for help
        if (this.containsAny(message, ['help', 'what can you do', 'how to use'])) {
            return this.getHelpMessage();
        }

        // Check for about/developer info
        if (this.containsAny(message, ['who are you', 'what are you', 'who made you', 'who created you', 'developer', 'who developed'])) {
            return "I was created by Shaikh Uzair! 👨‍💻 You can connect with him on LinkedIn: " + this.developer.linkedin;
        }

        
        // Check for clothing/what to wear advice
        if (this.containsAny(message, ['what to wear', 'clothing', 'dress', 'outfit', 'should i wear'])) {
            return await this.getClothingAdvice(message);
        }

        // Check for weather tips and advice
        if (this.containsAny(message, ['tips', 'advice', 'should i bring', 'umbrella', 'jacket'])) {
            return await this.getWeatherTips(message);
        }

        // Check for air quality queries
        if (this.containsAny(message, ['air quality', 'pollution', 'aqi', 'air pollution', 'smog'])) {
            return await this.getAirQualityInfo(message);
        }

        // Check for climate and seasonal patterns
        if (this.containsAny(message, ['climate', 'seasonal', 'typical weather', 'weather patterns', 'season'])) {
            return this.getClimateInfo(message);
        }

        // Check for weather alerts and warnings
        if (this.containsAny(message, ['alert', 'warning', 'severe weather', 'emergency', 'dangerous'])) {
            return await this.getWeatherAlerts(message);
        }

        // Weather query patterns
        const weatherPatterns = {
            temperature: ['temperature', 'how hot', 'how cold', 'how warm', 'degrees'],
            rain: ['rain', 'raining', 'rainfall', 'precipitation', 'umbrella', 'rainy'],
            forecast: ['forecast', 'next few days', 'tomorrow', 'later', 'week', 'upcoming'],
            conditions: ['conditions', 'weather like', 'weather now', 'current weather', 'outside'],
            wind: ['wind', 'windy', 'wind speed', 'breeze'],
            humidity: ['humidity', 'humid', 'moisture'],
            sun: ['sunny', 'sun', 'sunshine', 'bright'],
            cloud: ['cloudy', 'clouds', 'overcast'],
            storm: ['storm', 'thunder', 'lightning', 'thunderstorm']
        };

        // Extract location from message
        let targetLocation = '';
        const locationMatch = message.match(/(?:in|at|for|of)\s+([a-zA-Z\s,]+)(?:\s|$)/i);
        if (locationMatch) {
            targetLocation = locationMatch[1].trim();
        }

        // Handle "near me" or current location queries
        const isCurrentLocation = this.containsAny(message, ['here', 'near me', 'my location', 'current location']);
        
        try {
            let weatherData;
            if (isCurrentLocation || !targetLocation) {
                const position = await this.getCurrentLocation();
                const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}`);
                weatherData = await response.json();
            } else if (targetLocation) {
                const response = await fetch(`/.netlify/functions/weather?city=${encodeURIComponent(targetLocation)}`);
                weatherData = await response.json();
            }

            if (weatherData && weatherData.cod === 200) {
                if (this.containsAny(message, weatherPatterns.temperature)) {
                    const tempAdvice = this.getTemperatureAdvice(weatherData.main.temp);
                    return `The temperature in ${weatherData.name} is ${Math.round(weatherData.main.temp)}°C and feels like ${Math.round(weatherData.main.feels_like)}°C 🌡️\n\n${tempAdvice}`;
                }
                
                if (this.containsAny(message, weatherPatterns.rain)) {
                    const isRaining = weatherData.weather[0].main.toLowerCase().includes('rain');
                    const rainAdvice = isRaining ? this.weatherKnowledge.weatherTips.rain : "Perfect weather for outdoor activities!";
                    return isRaining 
                        ? `Yes, it's currently raining in ${weatherData.name}. ${rainAdvice} ☔` 
                        : `No rain at the moment in ${weatherData.name}! ${rainAdvice} ☀️`;
                }
                
                if (this.containsAny(message, weatherPatterns.wind)) {
                    const windAdvice = weatherData.wind.speed > 10 ? this.weatherKnowledge.weatherTips.wind : "Light winds, perfect for outdoor activities!";
                    return `The wind speed in ${weatherData.name} is ${weatherData.wind.speed} m/s ${weatherData.wind.gust ? `with gusts up to ${weatherData.wind.gust} m/s` : ''} 💨\n\n${windAdvice}`;
                }
                
                if (this.containsAny(message, weatherPatterns.humidity)) {
                    const humidityLevel = this.getHumidityLevel(weatherData.main.humidity);
                    return `The humidity in ${weatherData.name} is ${weatherData.main.humidity}% 💧\n\n${humidityLevel}`;
                }

                const weatherInsights = this.getWeatherInsights(weatherData);
                return `Current weather in ${weatherData.name}:
• Temperature: ${Math.round(weatherData.main.temp)}°C
• Feels like: ${Math.round(weatherData.main.feels_like)}°C
• Conditions: ${weatherData.weather[0].description}
• Humidity: ${weatherData.main.humidity}%
• Wind: ${weatherData.wind.speed} m/s
• Visibility: ${(weatherData.visibility / 1000).toFixed(1)} km
${weatherData.rain ? `• Rainfall: ${weatherData.rain['1h'] || weatherData.rain['3h'] || 0}mm` : ''}

💡 Weather Insights:
${weatherInsights}`;
            }
        } catch (error) {
            if (!targetLocation && isCurrentLocation) {
                return "I couldn't get your location. Please make sure you've allowed location access, or specify a city name.";
            }
            return "I couldn't get the weather information. Please try again with a different location or check the city name.";
        }

        // Check for weather in specific city
        const cityMatch = message.match(/(?:weather|temperature|forecast|condition|humidity|wind|rain|sun|cloud)[a-z\s]*(?:in|at|of|for)\s+([a-zA-Z\s]+)/i) || 
                         message.match(/(?:how|what)(?:'s|\s+is)\s+(?:the\s+)?(?:weather|temperature|forecast|condition|humidity|wind|rain|sun|cloud)[a-z\s]*(?:in|at|of|for)\s+([a-zA-Z\s]+)/i) ||
                         message.match(/([a-zA-Z\s]+)\s+(?:weather|temperature|forecast|condition|humidity|wind|rain|sun|cloud)/i);
        
        if (cityMatch) {
            const city = cityMatch[1].trim();
            return await this.getWeatherForCity(city);
        }

        // Check for rain queries
        if (this.containsAny(message, ['will it rain', 'is it raining', 'rain today', 'rainy', 'chance of rain', 'precipitation'])) {
            try {
                const position = await this.getCurrentLocation();
                const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}&forecast=1`);
                const data = await response.json();
                
                if (data.cod === '200') {
                    const next24Hours = data.list.slice(0, 8);
                    const rainForecasts = next24Hours.filter(item => 
                        item.weather[0].main.toLowerCase().includes('rain')
                    );
                    
                    if (rainForecasts.length > 0) {
                        const rainTime = new Date(rainForecasts[0].dt * 1000);
                        return `Yes, rain is expected ${rainTime.getHours()}:00 today. Don't forget your umbrella! ☔`;
                    } else {
                        return "No rain is expected in the next 24 hours. Should be clear! ☀️";
                    }
                }
            } catch (error) {
                return "I couldn't check the rain forecast. Please try asking about a specific city's weather instead.";
            }
        }

        // Check for temperature queries
        if (this.containsAny(message, ['temperature', 'how hot', 'how cold', 'degrees'])) {
            try {
                const position = await this.getCurrentLocation();
                const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}`);
                const data = await response.json();
                
                if (data.cod === 200) {
                    return `Current temperature in ${data.name} is ${Math.round(data.main.temp)}°C and it feels like ${Math.round(data.main.feels_like)}°C`;
                }
            } catch (error) {
                return "I couldn't get the temperature. Please specify a city name or make sure location access is enabled.";
            }
        }

        // Check for forecast queries
        if (this.containsAny(message, ['forecast', 'next day', 'tomorrow', 'week', 'upcoming'])) {
            try {
                const position = await this.getCurrentLocation();
                const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}&forecast=1`);
                const data = await response.json();
                
                if (data.cod === '200') {
                    let forecastText = `Weather forecast for ${data.city.name}:\n`;
                    const today = new Date().getDate();
                    
                    const dailyForecasts = data.list.filter(item => {
                        const itemDate = new Date(item.dt * 1000);
                        return itemDate.getHours() === 12 && itemDate.getDate() !== today;
                    }).slice(0, 5);

                    dailyForecasts.forEach((forecast, index) => {
                        const date = new Date(forecast.dt * 1000);
                        forecastText += `\n${index === 0 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' })}: ${Math.round(forecast.main.temp)}°C, ${forecast.weather[0].description}`;
                    });

                    return forecastText;
                }
            } catch (error) {
                return "I couldn't get the forecast. Please try asking about a specific city's weather instead.";
            }
        }

        // Fallback response with enhanced suggestions
        return `I understand you're asking about weather, but could you be more specific? You can ask about:
• Current weather in any city
• Weather near you
• Rain forecast and precipitation
• Temperature and feels-like temperature
• Weekly forecast and upcoming weather
• Air quality and pollution levels
• Weather alerts and warnings
• Clothing advice for the weather
• Weather tips and recommendations

Or try saying 'help' to see all my capabilities! 🌤️`;
    }

    async getClothingAdvice(message) {
        try {
            const position = await this.getCurrentLocation();
            const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}`);
            const data = await response.json();
            
            if (data.cod === 200) {
                const temp = data.main.temp;
                const feelsLike = data.main.feels_like;
                const condition = data.weather[0].main.toLowerCase();
                
                let advice = this.getClothingForTemperature(feelsLike);
                
                // Add condition-specific advice
                if (condition.includes('rain')) {
                    advice += "\n\n☔ Additional tip: " + this.weatherKnowledge.weatherTips.rain;
                } else if (condition.includes('snow')) {
                    advice += "\n\n❄️ Additional tip: " + this.weatherKnowledge.weatherTips.snow;
                } else if (data.wind.speed > 8) {
                    advice += "\n\n💨 Additional tip: " + this.weatherKnowledge.weatherTips.wind;
                }
                
                return `Clothing advice for ${data.name} (${Math.round(temp)}°C, feels like ${Math.round(feelsLike)}°C):\n\n${advice}`;
            }
        } catch (error) {
            return "I couldn't get the current weather for clothing advice. Please specify a city or enable location access.";
        }
    }

    async getWeatherTips(message) {
        try {
            const position = await this.getCurrentLocation();
            const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}`);
            const data = await response.json();
            
            if (data.cod === 200) {
                const condition = data.weather[0].main.toLowerCase();
                const temp = data.main.temp;
                const windSpeed = data.wind.speed;
                
                let tips = `Weather tips for ${data.name}:\n\n`;
                
                // Temperature-based tips
                if (temp > 30) {
                    tips += "🌡️ " + this.weatherKnowledge.weatherTips.heat + "\n\n";
                }
                
                // Condition-based tips
                if (condition.includes('rain')) {
                    tips += "☔ " + this.weatherKnowledge.weatherTips.rain + "\n\n";
                } else if (condition.includes('snow')) {
                    tips += "❄️ " + this.weatherKnowledge.weatherTips.snow + "\n\n";
                } else if (condition.includes('thunderstorm')) {
                    tips += "🌩️ " + this.weatherKnowledge.weatherTips.storm + "\n\n";
                } else if (data.visibility < 5000) {
                    tips += "🌫️ " + this.weatherKnowledge.weatherTips.fog + "\n\n";
                }
                
                // Wind-based tips
                if (windSpeed > 10) {
                    tips += "💨 " + this.weatherKnowledge.weatherTips.wind + "\n\n";
                }
                
                if (tips === `Weather tips for ${data.name}:\n\n`) {
                    tips += "🌤️ Great weather conditions! Perfect for outdoor activities and no special precautions needed.";
                }
                
                return tips.trim();
            }
        } catch (error) {
            return "I couldn't get weather information for tips. Please specify a city or enable location access.";
        }
    }

    async getAirQualityInfo(message) {
        try {
            const position = await this.getCurrentLocation();
            const response = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(position.lat)}&lon=${encodeURIComponent(position.lon)}&air=1`);
            const data = await response.json();
            
            if (data.list && data.list[0]) {
                const aqi = data.list[0].main.aqi;
                const components = data.list[0].components;
                
                const aqiInfo = this.weatherKnowledge.airQualityInfo[aqi];
                
                return `Air Quality Information:
• Air Quality Index: ${aqi}/5
• Status: ${aqiInfo}

Detailed Pollutant Levels:
• PM2.5: ${components.pm2_5} μg/m³
• PM10: ${components.pm10} μg/m³
• NO2: ${components.no2} μg/m³
• O3: ${components.o3} μg/m³
• CO: ${components.co} μg/m³

💡 Health Recommendation: ${this.getHealthRecommendation(aqi)}`;
            }
        } catch (error) {
            return "I couldn't get air quality information. Please try again or specify a different location.";
        }
    }

    getClimateInfo(message) {
        const currentMonth = new Date().getMonth();
        let season;
        
        if (currentMonth >= 2 && currentMonth <= 4) season = 'spring';
        else if (currentMonth >= 5 && currentMonth <= 7) season = 'summer';
        else if (currentMonth >= 8 && currentMonth <= 10) season = 'autumn';
        else season = 'winter';
        
        const seasonInfo = this.weatherKnowledge.climatePatterns[season];
        
        return `Current Season: ${season.charAt(0).toUpperCase() + season.slice(1)}

${seasonInfo}

🌍 Climate Tips:
• Weather patterns can vary significantly by geographic location
• Coastal areas tend to have more moderate temperatures
• Mountain regions experience more variable weather
• Urban areas may be warmer due to the heat island effect

Would you like specific climate information for a particular city or region?`;
    }

    async getWeatherAlerts(message) {
        try {
            const position = await this.getCurrentLocation();
            // Note: This would require a premium API key for alerts
            return `Weather Alert Information:

⚠️ I can check for severe weather conditions, but detailed alerts require premium weather services.

Current Safety Checks:
• Monitor local weather services for official warnings
• Check radar for approaching storms
• Be aware of seasonal weather patterns
• Have emergency supplies ready during severe weather seasons

For official weather alerts and warnings, I recommend checking your local meteorological service or weather.gov (for US locations).

Would you like me to check current conditions for any severe weather indicators?`;
        } catch (error) {
            return "I couldn't access weather alert information. Please check local weather services for official warnings.";
        }
    }

    getTemperatureAdvice(temp) {
        if (temp > 35) return "🔥 Extremely hot! Stay hydrated and avoid prolonged sun exposure.";
        if (temp > 25) return "☀️ Warm and pleasant! Great weather for outdoor activities.";
        if (temp > 15) return "🌤️ Mild temperature, perfect for a walk or light outdoor activities.";
        if (temp > 5) return "🧥 Cool weather, you might want to wear a light jacket.";
        if (temp > -5) return "❄️ Cold! Bundle up with warm clothing.";
        return "🥶 Very cold! Dress in layers and limit time outdoors.";
    }

    getClothingForTemperature(temp) {
        if (temp > 30) return this.weatherKnowledge.clothingAdvice.hot;
        if (temp > 20) return this.weatherKnowledge.clothingAdvice.warm;
        if (temp > 15) return this.weatherKnowledge.clothingAdvice.mild;
        if (temp > 5) return this.weatherKnowledge.clothingAdvice.cool;
        if (temp > -5) return this.weatherKnowledge.clothingAdvice.cold;
        return this.weatherKnowledge.clothingAdvice.freezing;
    }

    getHumidityLevel(humidity) {
        if (humidity > 80) return "Very humid conditions. You might feel sticky and uncomfortable.";
        if (humidity > 60) return "Moderately humid. The air feels a bit thick.";
        if (humidity > 40) return "Comfortable humidity levels.";
        if (humidity > 20) return "Low humidity. You might experience dry skin or static.";
        return "Very dry air. Consider using a humidifier indoors.";
    }

    getWeatherInsights(data) {
        const insights = [];
        
        if (data.main.temp > 30) insights.push("🔥 Hot day ahead - stay hydrated!");
        if (data.main.humidity > 80) insights.push("💧 High humidity - expect muggy conditions");
        if (data.wind.speed > 10) insights.push("💨 Windy conditions - secure loose items");
        if (data.visibility < 5000) insights.push("🌫️ Reduced visibility - drive carefully");
        if (data.weather[0].main.includes('Rain')) insights.push("☔ Rain expected - bring an umbrella");
        
        return insights.length > 0 ? insights.join('\n') : "🌤️ Pleasant weather conditions overall!";
    }

    getHealthRecommendation(aqi) {
        switch(aqi) {
            case 1: return "Perfect for all outdoor activities including exercise and sports.";
            case 2: return "Great conditions for outdoor activities with minimal health concerns.";
            case 3: return "Generally acceptable, but sensitive individuals should monitor symptoms.";
            case 4: return "Consider limiting prolonged outdoor activities, especially exercise.";
            case 5: return "Avoid outdoor activities. Stay indoors and use air purification if available.";
            default: return "Monitor air quality conditions and adjust activities accordingly.";
        }
    }

    matchesCommand(message, commandType) {
        return this.commands[commandType].some(cmd => message.includes(cmd));
    }

    getGreeting() {
        const greetings = [
            "👋 Hi there! How can I help you with the weather today?",
            "Hello! Ready to talk about the weather?",
            "Hey! What would you like to know about the weather?",
            "Hi! I'm here to help with your weather questions!"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    getFarewell() {
        const farewells = [
            "Goodbye! Have a great day! ☀️",
            "See you later! Stay weather-ready! 🌤️",
            "Take care! Come back if you need more weather updates! 👋",
            "Bye! Don't forget your umbrella if it's going to rain! ☔"
        ];
        return farewells[Math.floor(Math.random() * farewells.length)];
    }

    getThankYouResponse() {
        const responses = [
            "You're welcome! Let me know if you need anything else! 😊",
            "Anytime! I'm always here to help with weather info! ☀️",
            "My pleasure! Feel free to ask more questions! 🌤️",
            "No problem! That's what I'm here for! 👍"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    getAboutInfo(aboutType = '') {
        // Always give a direct, clear response about the creator
        return `I was created by Shaikh Uzair! 👨‍💻 You can connect with him on LinkedIn: ${this.developer.linkedin}`;
    }

    getHelpMessage() {
        return `Here's what you can ask me about:

🌤️ **Weather Information:**
• Current weather in any city
• Weather forecast and predictions
• Temperature, humidity, wind conditions
• Rain, snow, and storm forecasts

🧥 **Weather Advice:**
• What to wear based on weather
• Weather tips and recommendations
• Should I bring an umbrella?
• Outdoor activity suggestions

🌍 **Advanced Weather:**
• Air quality and pollution levels
• Weather alerts and warnings
• Climate patterns and seasonal info
• Weather comparisons between cities

💬 **General:**
• Ask about my developer
• Get weather tips for travel
• Seasonal weather patterns

Just ask me naturally - I understand conversational language! 😊`;
    }

    // Fetch and store comprehensive weather data
    async fetchWeatherData(city) {
        try {
            // Check cache first
            if (this.isCacheValid(city)) {
                return {
                    current: this.cache.current.get(city),
                    forecast: this.cache.forecast.get(city),
                    alerts: this.cache.alerts.get(city),
                    airQuality: this.cache.airQuality.get(city)
                };
            }

            // Get coordinates first (via serverless proxy)
            const geoResponse = await fetch(`/.netlify/functions/weather?geocode=1&city=${encodeURIComponent(city)}`);
            const [geoData] = await geoResponse.json();

            if (!geoData) {
                throw new Error('City not found');
            }

            const { lat, lon } = geoData;

            // Fetch current weather (proxy)
            const currentResponse = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
            const current = await currentResponse.json();

            // Fetch 5-day forecast with 3-hour intervals (proxy)
            const forecastResponse = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&forecast=1`);
            const forecast = await forecastResponse.json();

            // Fetch weather alerts / onecall (proxy)
            const oneCallResponse = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&onecall=1`);
            const oneCallData = await oneCallResponse.json();

            // Fetch air quality data (proxy)
            const airQualityResponse = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&air=1`);
            const airQuality = await airQualityResponse.json();

            // Store in cache
            this.cache.current.set(city, current);
            this.cache.forecast.set(city, forecast);
            this.cache.alerts.set(city, oneCallData.alerts || []);
            this.cache.airQuality.set(city, airQuality);
            this.cache.lastUpdate.set(city, Date.now());

            return { current, forecast, alerts: oneCallData.alerts || [], airQuality };
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }

    isCacheValid(city) {
        const lastUpdate = this.cache.lastUpdate.get(city);
        return lastUpdate && (Date.now() - lastUpdate < this.cacheDuration);
    }

    async getWeatherForCity(city) {
        try {
            const data = await this.fetchWeatherData(city);
            const current = data.current;
            const forecast = data.forecast;
            const alerts = data.alerts;
            const airQuality = data.airQuality;

            let response = `Current weather in ${current.name}:\n`;
            response += `• Temperature: ${Math.round(current.main.temp)}°C\n`;
            response += `• Feels like: ${Math.round(current.main.feels_like)}°C\n`;
            response += `• Conditions: ${current.weather[0].description}\n`;
            response += `• Humidity: ${current.main.humidity}%\n`;
            response += `• Wind: ${current.wind.speed} m/s\n`;
            
            // Add air quality if available
            if (airQuality && airQuality.list && airQuality.list[0]) {
                const aqi = airQuality.list[0].main.aqi;
                const aqiLabels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
                response += `• Air Quality: ${aqiLabels[aqi - 1]}\n`;
            }

            // Add weather alerts if any
            if (alerts && alerts.length > 0) {
                response += `\n⚠️ Weather Alert: ${alerts[0].event}\n`;
            }

            // Add next 12 hours forecast summary
            const next12Hours = forecast.list.slice(0, 4);
            response += '\nUpcoming weather:\n';
            next12Hours.forEach(item => {
                const time = new Date(item.dt * 1000).getHours();
                response += `• ${time}:00 - ${Math.round(item.main.temp)}°C, ${item.weather[0].description}\n`;
            });

            return response;

        } catch (error) {
            if (error.message === 'City not found') {
                return "Sorry, I couldn't find that city. Please try another one!";
            }
            return "Sorry, I'm having trouble getting the weather information right now.";
        }
    }

    async getWeatherDetails(city) {
        try {
            const data = await this.fetchWeatherData(city);
            const current = data.current;
            const airQuality = data.airQuality;

            let response = `Detailed weather information for ${current.name}:\n\n`;
            response += `Temperature:\n`;
            response += `• Current: ${Math.round(current.main.temp)}°C\n`;
            response += `• Feels like: ${Math.round(current.main.feels_like)}°C\n`;
            response += `• Min: ${Math.round(current.main.temp_min)}°C\n`;
            response += `• Max: ${Math.round(current.main.temp_max)}°C\n\n`;

            response += `Atmospheric Conditions:\n`;
            response += `• Humidity: ${current.main.humidity}%\n`;
            response += `• Pressure: ${current.main.pressure} hPa\n`;
            response += `• Visibility: ${(current.visibility / 1000).toFixed(1)} km\n\n`;

            response += `Wind:\n`;
            response += `• Speed: ${current.wind.speed} m/s\n`;
            response += `• Direction: ${this.getWindDirection(current.wind.deg)}\n`;
            if (current.wind.gust) {
                response += `• Gusts: ${current.wind.gust} m/s\n`;
            }

            if (airQuality && airQuality.list && airQuality.list[0]) {
                const aq = airQuality.list[0].components;
                response += `\nAir Quality:\n`;
                response += `• PM2.5: ${aq.pm2_5} μg/m³\n`;
                response += `• PM10: ${aq.pm10} μg/m³\n`;
                response += `• NO2: ${aq.no2} μg/m³\n`;
                response += `• O3: ${aq.o3} μg/m³\n`;
            }

            if (current.rain) {
                response += `\nRain:\n`;
                if (current.rain['1h']) response += `• Last hour: ${current.rain['1h']} mm\n`;
                if (current.rain['3h']) response += `• Last 3 hours: ${current.rain['3h']} mm\n`;
            }

            if (current.snow) {
                response += `\nSnow:\n`;
                if (current.snow['1h']) response += `• Last hour: ${current.snow['1h']} mm\n`;
                if (current.snow['3h']) response += `• Last 3 hours: ${current.snow['3h']} mm\n`;
            }

            return response;
        } catch (error) {
            return "Sorry, I couldn't get the detailed weather information. Please try again later.";
        }
    }

    async getWeatherConditions(city) {
        try {
            const data = await this.fetchWeatherData(city);
            const current = data.current;
            const forecast = data.forecast;
            const alerts = data.alerts;

            let response = `Weather conditions in ${current.name}:\n\n`;
            response += `Current Conditions:\n`;
            response += `• ${current.weather[0].description}\n`;
            response += `• Cloud cover: ${current.clouds.all}%\n`;

            if (current.rain || current.snow) {
                response += `\nPrecipitation:\n`;
                if (current.rain) {
                    response += `• Rain: ${current.rain['1h'] || current.rain['3h'] || 0} mm\n`;
                }
                if (current.snow) {
                    response += `• Snow: ${current.snow['1h'] || current.snow['3h'] || 0} mm\n`;
                }
            }

            // Check for upcoming conditions
            const next24Hours = forecast.list.slice(0, 8);
            const conditions = next24Hours.map(item => item.weather[0].main.toLowerCase());
            
            response += '\nNext 24 hours:\n';
            if (conditions.includes('rain')) {
                response += '• Rain expected\n';
            }
            if (conditions.includes('snow')) {
                response += '• Snow expected\n';
            }
            if (conditions.includes('thunderstorm')) {
                response += '• Thunderstorms possible\n';
            }

            // Add any weather alerts
            if (alerts && alerts.length > 0) {
                response += '\n⚠️ Weather Alerts:\n';
                alerts.forEach(alert => {
                    response += `• ${alert.event}: ${alert.description}\n`;
                });
            }

            return response;
        } catch (error) {
            return "Sorry, I couldn't get the current weather conditions. Please try again later.";
        }
    }

    async getWeatherForecast(city) {
        try {
            const data = await this.fetchWeatherData(city);
            const forecast = data.forecast;
            
            let response = `5-day forecast for ${forecast.city.name}:\n\n`;
            
            // Group forecasts by day
            const dailyForecasts = new Map();
            forecast.list.forEach(item => {
                const date = new Date(item.dt * 1000);
                const dayKey = date.toLocaleDateString('en-US', { weekday: 'long' });
                
                if (!dailyForecasts.has(dayKey)) {
                    dailyForecasts.set(dayKey, {
                        temps: [],
                        conditions: new Set(),
                        rain: false,
                        snow: false,
                        thunderstorm: false
                    });
                }
                
                const day = dailyForecasts.get(dayKey);
                day.temps.push(item.main.temp);
                day.conditions.add(item.weather[0].main);
                day.rain = day.rain || item.weather[0].main === 'Rain';
                day.snow = day.snow || item.weather[0].main === 'Snow';
                day.thunderstorm = day.thunderstorm || item.weather[0].main === 'Thunderstorm';
            });

            // Format the forecast for each day
            let dayCount = 0;
            for (const [day, data] of dailyForecasts) {
                if (dayCount >= 5) break;
                
                const minTemp = Math.round(Math.min(...data.temps));
                const maxTemp = Math.round(Math.max(...data.temps));
                const conditions = Array.from(data.conditions).join(', ');
                
                response += `${day}:\n`;
                response += `• Temperature: ${minTemp}°C to ${maxTemp}°C\n`;
                response += `• Conditions: ${conditions}\n`;
                
                if (data.rain) response += `• Rain expected\n`;
                if (data.snow) response += `• Snow expected\n`;
                if (data.thunderstorm) response += `• Thunderstorms possible\n`;
                
                response += '\n';
                dayCount++;
            }

            return response;
        } catch (error) {
            return "Sorry, I couldn't get the forecast information. Please try again later.";
        }
    }

    getWindDirection(degrees) {
        const directions = ['North', 'North-Northeast', 'Northeast', 'East-Northeast', 'East', 
                          'East-Southeast', 'Southeast', 'South-Southeast', 'South', 
                          'South-Southwest', 'Southwest', 'West-Southwest', 'West', 
                          'West-Northwest', 'Northwest', 'North-Northwest'];
        const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 22.5);
        return directions[index % 16];
    }
}

/*
 * Idempotent initializer for the chatbot UI.
 * Safe to call multiple times (will only initialize once).
 * Exported to window so other deferred scripts/pages can call it.
 */
window.initializeChatbot = (function () {
    let initialized = false;

    return function () {
        if (initialized) return; // already initialized
        initialized = true;

        // basic DOM-safe init: attach event handlers if elements exist
        try {
            const chatbot = new WeatherChatbot();
            const chatContainer = document.querySelector('.chat-container');
            const chatHeader = document.querySelector('.chat-header');
            const minimizeBtn = document.querySelector('.minimize-btn');
            const input = document.querySelector('.chat-input input');
            const sendBtn = document.querySelector('.chat-input button');
            const messagesContainer = document.querySelector('.chat-messages');
            const typingIndicator = document.querySelector('.typing-indicator');

            if (!chatContainer || !chatHeader || !minimizeBtn || !input || !sendBtn || !messagesContainer) {
                // Missing required DOM nodes; skip UI init but keep chatbot class available
                return;
            }

            // welcome message
            setTimeout(() => {
                const msg = document.createElement('div');
                msg.className = 'message bot-message';
                msg.textContent = "Hi! I'm your Weather Assistant. Ask me anything about weather!";
                messagesContainer.appendChild(msg);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 800);

            const toggleChat = () => chatContainer.classList.toggle('minimized');

            chatHeader.addEventListener('click', () => {
                if (chatContainer.classList.contains('minimized')) toggleChat();
            });

            minimizeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleChat(); });

            async function handleMessage() {
                const message = input.value.trim();
                if (!message) return;
                input.value = '';
                const userMsg = document.createElement('div');
                userMsg.className = 'message user-message';
                userMsg.textContent = message;
                messagesContainer.appendChild(userMsg);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                typingIndicator && (typingIndicator.style.display = 'block');

                try {
                    const response = await chatbot.processMessage(message);
                    typingIndicator && (typingIndicator.style.display = 'none');
                    const botMsg = document.createElement('div');
                    botMsg.className = 'message bot-message';
                    botMsg.textContent = response;
                    messagesContainer.appendChild(botMsg);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } catch (e) {
                    typingIndicator && (typingIndicator.style.display = 'none');
                    const errMsg = document.createElement('div');
                    errMsg.className = 'message bot-message';
                    errMsg.textContent = "Sorry, I couldn't process that right now.";
                    messagesContainer.appendChild(errMsg);
                }
            }

            sendBtn.addEventListener('click', handleMessage);
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleMessage(); });

        } catch (err) {
            console.error('Chatbot initialization error:', err);
        }
    };
})();
