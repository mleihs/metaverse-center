"""Source adapters — import all to trigger self-registration."""

from backend.services.scanning.adapters.disease_sh import DiseaseSHAdapter
from backend.services.scanning.adapters.gdacs import GDACSAdapter
from backend.services.scanning.adapters.gdelt import GDELTAdapter
from backend.services.scanning.adapters.guardian_scanner import GuardianScannerAdapter
from backend.services.scanning.adapters.hackernews import HackerNewsScannerAdapter
from backend.services.scanning.adapters.nasa_eonet import NASAEONETAdapter
from backend.services.scanning.adapters.newsapi_scanner import NewsAPIScannerAdapter
from backend.services.scanning.adapters.noaa_alerts import NOAAAlertAdapter
from backend.services.scanning.adapters.usgs_earthquakes import USGSEarthquakeAdapter
from backend.services.scanning.adapters.who_outbreaks import WHOOutbreaksAdapter

__all__ = [
    "USGSEarthquakeAdapter",
    "NOAAAlertAdapter",
    "NASAEONETAdapter",
    "GDACSAdapter",
    "DiseaseSHAdapter",
    "WHOOutbreaksAdapter",
    "GuardianScannerAdapter",
    "NewsAPIScannerAdapter",
    "GDELTAdapter",
    "HackerNewsScannerAdapter",
]
