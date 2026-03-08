"""Tests for paginate_response() helper in base_service."""

from unittest.mock import MagicMock

from backend.services.base_service import paginate_response


class TestPaginateResponse:
    def test_extracts_data_and_exact_count(self):
        resp = MagicMock()
        resp.data = [{"id": "1"}, {"id": "2"}]
        resp.count = 10

        data, total = paginate_response(resp)

        assert data == [{"id": "1"}, {"id": "2"}]
        assert total == 10

    def test_falls_back_to_len_when_count_is_none(self):
        resp = MagicMock()
        resp.data = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        resp.count = None

        data, total = paginate_response(resp)

        assert len(data) == 3
        assert total == 3

    def test_handles_empty_data(self):
        resp = MagicMock()
        resp.data = []
        resp.count = 0

        data, total = paginate_response(resp)

        assert data == []
        assert total == 0

    def test_handles_none_data(self):
        resp = MagicMock()
        resp.data = None
        resp.count = None

        data, total = paginate_response(resp)

        assert data == []
        assert total == 0

    def test_handles_missing_data_attribute(self):
        """Object without .data attribute should return empty list."""
        resp = object()

        data, total = paginate_response(resp)

        assert data == []
        assert total == 0

    def test_count_zero_with_data(self):
        """When count is explicitly 0 but data exists (edge case), trust count."""
        resp = MagicMock()
        resp.data = [{"id": "1"}]
        resp.count = 0

        data, total = paginate_response(resp)

        assert data == [{"id": "1"}]
        assert total == 0
