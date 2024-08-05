const apiKey = '4742ff912b66de7611f55ba71a70ab5c'; // Replace with your actual API key



function fetchWeather(index) {
    const location = locations[index];
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const weatherInfo = document.querySelectorAll('.weather-info')[index];
            weatherInfo.innerHTML = `
                <p>Temperature: ${data.main.temp}°C</p>
                <p>Weather: ${data.weather[0].main}</p>
                <p>Humidity: ${data.main.humidity}%</p>
            `;
        })
        .catch(error => console.error('Error fetching weather:', error));
}

// Fetch weather for all locations
locations.forEach((_, index) => fetchWeather(index));

// Update weather every 10 minutes
setInterval(() => {
    locations.forEach((_, index) => fetchWeather(index));
}, 300000);