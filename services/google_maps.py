"""Google Maps / Places API — find local service businesses."""

from __future__ import annotations

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()

PLACES_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


async def search_businesses(
    query: str,
    location: str | None = None,
    radius_meters: int = 50_000,
) -> list[dict]:
    """
    Search for businesses via Google Places Text Search.

    Args:
        query: e.g. "plumbers in Austin TX"
        location: lat,lng string (optional — text search handles location in query)
        radius_meters: search radius

    Returns list of place results with name, address, website, etc.
    """
    params: dict = {
        "query": query,
        "key": settings.google_maps_api_key,
    }
    if location:
        params["location"] = location
        params["radius"] = radius_meters

    results = []
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(PLACES_SEARCH_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

        for place in data.get("results", []):
            results.append({
                "place_id": place.get("place_id"),
                "name": place.get("name"),
                "address": place.get("formatted_address"),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("user_ratings_total"),
                "types": place.get("types", []),
            })

    log.info("google_maps.search", query=query, results_count=len(results))
    return results


async def get_place_details(place_id: str) -> dict:
    """Get detailed info including website and phone for a place."""
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,website,formatted_phone_number,url,opening_hours,business_status",
        "key": settings.google_maps_api_key,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(PLACE_DETAILS_URL, params=params)
        resp.raise_for_status()
        result = resp.json().get("result", {})

    return {
        "name": result.get("name"),
        "address": result.get("formatted_address"),
        "website": result.get("website"),
        "phone": result.get("formatted_phone_number"),
        "google_url": result.get("url"),
        "business_status": result.get("business_status"),
    }
