"""Google Places API integration for venue search."""
import os
from typing import List, Optional
import httpx
from dotenv import load_dotenv

from models.schemas import VenueProposal

load_dotenv()

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


MOCK_VENUES: dict = {
    "dinner_night": [
        VenueProposal(
            name="The Golden Fork",
            address="123 Main St, Downtown",
            type="restaurant",
            rating=4.5,
            price_level=2,
            lat=37.7749,
            lng=-122.4194,
            proposed_by="system",
            score=88.0,
        ),
        VenueProposal(
            name="Sakura Garden",
            address="456 Oak Ave, Midtown",
            type="restaurant",
            rating=4.7,
            price_level=3,
            lat=37.7800,
            lng=-122.4150,
            proposed_by="system",
            score=92.0,
        ),
        VenueProposal(
            name="Bella Trattoria",
            address="789 Elm St, Little Italy",
            type="restaurant",
            rating=4.3,
            price_level=2,
            lat=37.7700,
            lng=-122.4200,
            proposed_by="system",
            score=80.0,
        ),
    ],
    "chill_hangout": [
        VenueProposal(
            name="Brewed Awakening",
            address="321 Coffee Lane",
            type="cafe",
            rating=4.4,
            price_level=1,
            lat=37.7760,
            lng=-122.4180,
            proposed_by="system",
            score=85.0,
        ),
        VenueProposal(
            name="The Velvet Lounge",
            address="654 Chill Blvd",
            type="bar",
            rating=4.2,
            price_level=2,
            lat=37.7780,
            lng=-122.4160,
            proposed_by="system",
            score=78.0,
        ),
        VenueProposal(
            name="Mosaic Park Pavilion",
            address="987 Park Drive",
            type="park",
            rating=4.6,
            price_level=0,
            lat=37.7720,
            lng=-122.4210,
            proposed_by="system",
            score=82.0,
        ),
    ],
    "startup_brainstorm": [
        VenueProposal(
            name="The Hive Coworking",
            address="100 Innovation Way",
            type="coworking_space",
            rating=4.5,
            price_level=2,
            lat=37.7830,
            lng=-122.4100,
            proposed_by="system",
            score=90.0,
        ),
        VenueProposal(
            name="Caffeine & Code",
            address="200 Tech Row",
            type="cafe",
            rating=4.3,
            price_level=1,
            lat=37.7810,
            lng=-122.4120,
            proposed_by="system",
            score=84.0,
        ),
        VenueProposal(
            name="Nexus Hub",
            address="300 Startup St",
            type="coworking_space",
            rating=4.6,
            price_level=3,
            lat=37.7850,
            lng=-122.4080,
            proposed_by="system",
            score=91.0,
        ),
    ],
    "study_session": [
        VenueProposal(
            name="Central Public Library",
            address="10 Library Plaza",
            type="library",
            rating=4.7,
            price_level=0,
            lat=37.7790,
            lng=-122.4170,
            proposed_by="system",
            score=93.0,
        ),
        VenueProposal(
            name="Quiet Grounds Cafe",
            address="20 Studious Ave",
            type="cafe",
            rating=4.4,
            price_level=1,
            lat=37.7770,
            lng=-122.4190,
            proposed_by="system",
            score=86.0,
        ),
        VenueProposal(
            name="University Study Hall",
            address="30 Campus Blvd",
            type="library",
            rating=4.5,
            price_level=0,
            lat=37.7750,
            lng=-122.4205,
            proposed_by="system",
            score=88.0,
        ),
    ],
    "default": [
        VenueProposal(
            name="The Meeting Point",
            address="1 Central Plaza",
            type="venue",
            rating=4.3,
            price_level=2,
            lat=37.7749,
            lng=-122.4194,
            proposed_by="system",
            score=80.0,
        ),
        VenueProposal(
            name="Common Ground Cafe",
            address="2 Harmony Street",
            type="cafe",
            rating=4.5,
            price_level=1,
            lat=37.7760,
            lng=-122.4180,
            proposed_by="system",
            score=85.0,
        ),
        VenueProposal(
            name="Nexus Rooftop Bar",
            address="3 Skyline Ave",
            type="bar",
            rating=4.4,
            price_level=3,
            lat=37.7770,
            lng=-122.4165,
            proposed_by="system",
            score=82.0,
        ),
    ],
}


def _get_mock_venues(template: str) -> List[VenueProposal]:
    """Return mock venues for a given template."""
    key = template.lower().replace(" ", "_")
    return MOCK_VENUES.get(key, MOCK_VENUES["default"])


def _price_level_from_google(pl: Optional[int]) -> Optional[int]:
    return pl  # Google already returns 0-4


async def search_venues(query: str, location: str, template: str) -> List[VenueProposal]:
    """
    Search Google Places Text Search API for venues.
    Returns top 5 venues as VenueProposal objects.
    Falls back to mock data if API key is not configured.
    """
    if not GOOGLE_PLACES_API_KEY:
        return _get_mock_venues(template)

    full_query = f"{query} in {location}"
    params = {
        "query": full_query,
        "key": GOOGLE_PLACES_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(PLACES_TEXT_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", [])[:5]
        venues: List[VenueProposal] = []

        for r in results:
            geo = r.get("geometry", {}).get("location", {})
            venue_type = "venue"
            types = r.get("types", [])
            for t in types:
                if t not in ("point_of_interest", "establishment"):
                    venue_type = t.replace("_", " ")
                    break

            venues.append(
                VenueProposal(
                    name=r.get("name", "Unknown"),
                    address=r.get("formatted_address", ""),
                    type=venue_type,
                    rating=r.get("rating"),
                    price_level=r.get("price_level"),
                    lat=geo.get("lat"),
                    lng=geo.get("lng"),
                    proposed_by="system",
                    score=float(r.get("rating", 4.0)) * 20.0,
                )
            )

        return venues if venues else _get_mock_venues(template)

    except Exception:
        return _get_mock_venues(template)


async def get_venue_details(place_id: str) -> dict:
    """
    Fetch details for a specific place by place_id.
    Returns dict with address, rating, price_level, lat, lng.
    """
    if not GOOGLE_PLACES_API_KEY:
        return {
            "name": "Mock Venue",
            "address": "123 Mock Street",
            "rating": 4.2,
            "price_level": 2,
            "lat": 37.7749,
            "lng": -122.4194,
        }

    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,rating,price_level,geometry",
        "key": GOOGLE_PLACES_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(PLACES_DETAILS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        result = data.get("result", {})
        geo = result.get("geometry", {}).get("location", {})

        return {
            "name": result.get("name", ""),
            "address": result.get("formatted_address", ""),
            "rating": result.get("rating"),
            "price_level": result.get("price_level"),
            "lat": geo.get("lat"),
            "lng": geo.get("lng"),
        }
    except Exception:
        return {
            "name": "Unknown Venue",
            "address": "Address unavailable",
            "rating": None,
            "price_level": None,
            "lat": None,
            "lng": None,
        }
