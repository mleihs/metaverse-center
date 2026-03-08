"""Substrate Scanner — automated real-world event detection pipeline."""

import backend.services.scanning.adapters  # noqa: F401 — triggers self-registration

from backend.services.scanning.scanner_service import ScannerService

__all__ = ["ScannerService"]
