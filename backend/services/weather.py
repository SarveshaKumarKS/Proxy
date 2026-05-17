"""OpenWeather API integration for weather context."""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"


def _describe_weather(data: dict) -> str:
    """Convert OpenWeather API response into a natural language sentence."""
    weather_list = data.get("weather", [{}])
    description = weather_list[0].get("description", "clear").capitalize()
    main_weather = weather_list[0].get("main", "Clear")
    temp_k = data.get("main", {}).get("temp", 293)
    temp_f = round((temp_k - 273.15) * 9 / 5 + 32)
    temp_c = round(temp_k - 273.15)
    wind_mps = data.get("wind", {}).get("speed", 0)
    wind_mph = round(wind_mps * 2.237)

    # Choose indoor/outdoor suggestion
    if main_weather in ("Rain", "Drizzle", "Thunderstorm", "Snow"):
        suggestion = "consider indoor options"
    elif temp_f < 40:
        suggestion = "bundle up or find somewhere warm"
    elif temp_f > 90:
        suggestion = "seek air-conditioned spots"
    elif wind_mph > 20:
        suggestion = "a breezy evening — indoor spots may be cozier"
    else:
        suggestion = "outdoor options look pleasant"

    return f"{description}, {temp_f}°F ({temp_c}°C) — {suggestion}"


async def get_weather_context(location: str) -> str:
    """
    Fetch current weather for the given location string.
    Returns a one-sentence natural language description.
    Falls back gracefully if the API key is not set or the call fails.
    """
    if not OPENWEATHER_API_KEY:
        return "Weather data unavailable"

    params = {
        "q": location,
        "appid": OPENWEATHER_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPENWEATHER_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return _describe_weather(data)

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return f"Location '{location}' not found — weather data unavailable"
        return "Weather data unavailable"
    except Exception:
        return "Weather data unavailable"
