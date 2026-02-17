"""Tests for the Browse workflow — ephemeral articles without DB storage.

Covers:
1. GuardianService.browse() — browse without query
2. NewsAPIService.browse() — top-headlines endpoint
3. BrowseArticlesRequest / TransformArticleRequest / IntegrateArticleRequest models
4. _generate_reactions_for_event() shared helper (mocked)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")
MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


# ---------------------------------------------------------------------------
# GuardianService.browse() unit tests
# ---------------------------------------------------------------------------


class TestGuardianBrowse:
    """Test GuardianService.browse() method."""

    async def test_browse_without_query(self):
        from backend.services.external.guardian import GuardianService

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": {
                "results": [
                    {
                        "webTitle": "Test Article",
                        "webUrl": "https://guardian.co.uk/test",
                        "webPublicationDate": "2026-02-17T12:00:00Z",
                        "sectionId": "world",
                        "fields": {
                            "headline": "Test Headline",
                            "trailText": "Test trail text",
                            "byline": "Test Author",
                            "thumbnail": "https://example.com/thumb.jpg",
                        },
                    }
                ]
            }
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            service = GuardianService("test-key")
            articles = await service.browse(limit=5)

        assert len(articles) == 1
        assert articles[0]["name"] == "Test Headline"
        assert articles[0]["platform"] == "guardian"
        assert articles[0]["url"] == "https://guardian.co.uk/test"
        assert articles[0]["raw_data"]["section"] == "world"
        assert articles[0]["raw_data"]["thumbnail"] == "https://example.com/thumb.jpg"

        # Verify no "q" parameter was sent (browse, not search)
        call_kwargs = mock_instance.get.call_args
        params = call_kwargs.kwargs.get("params") or call_kwargs[1].get("params")
        assert "q" not in params
        assert params["order-by"] == "newest"

    async def test_browse_with_section(self):
        from backend.services.external.guardian import GuardianService

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": {"results": []}}

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            service = GuardianService("test-key")
            await service.browse(section="technology", limit=10)

        call_kwargs = mock_instance.get.call_args
        params = call_kwargs.kwargs.get("params") or call_kwargs[1].get("params")
        assert params["section"] == "technology"


# ---------------------------------------------------------------------------
# NewsAPIService.browse() unit tests
# ---------------------------------------------------------------------------


class TestNewsAPIBrowse:
    """Test NewsAPIService.browse() method."""

    async def test_browse_top_headlines(self):
        from backend.services.external.newsapi import NewsAPIService

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "ok",
            "articles": [
                {
                    "title": "NewsAPI Article",
                    "url": "https://example.com/article",
                    "source": {"name": "Test Source"},
                    "author": "Test Author",
                    "description": "Test description",
                    "publishedAt": "2026-02-17T12:00:00Z",
                    "urlToImage": "https://example.com/image.jpg",
                }
            ],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            service = NewsAPIService("test-key")
            articles = await service.browse(limit=5)

        assert len(articles) == 1
        assert articles[0]["name"] == "NewsAPI Article"
        assert articles[0]["platform"] == "newsapi"
        assert articles[0]["raw_data"]["source"] == "Test Source"

        # Verify top-headlines endpoint used (not /everything)
        call_args = mock_instance.get.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url", "")
        assert "top-headlines" in url

    async def test_browse_with_country(self):
        from backend.services.external.newsapi import NewsAPIService

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok", "articles": []}

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client.return_value = mock_instance

            service = NewsAPIService("test-key")
            await service.browse(country="us", limit=5)

        call_kwargs = mock_instance.get.call_args
        params = call_kwargs.kwargs.get("params") or call_kwargs[1].get("params")
        assert params["country"] == "us"


# ---------------------------------------------------------------------------
# Pydantic model validation tests
# ---------------------------------------------------------------------------


class TestBrowseArticlesRequestModel:
    """Test BrowseArticlesRequest model validation."""

    def test_default_values(self):
        from backend.models.social_trend import BrowseArticlesRequest

        req = BrowseArticlesRequest()
        assert req.source == "guardian"
        assert req.query is None
        assert req.section is None
        assert req.limit == 15

    def test_with_query(self):
        from backend.models.social_trend import BrowseArticlesRequest

        req = BrowseArticlesRequest(source="newsapi", query="climate change", limit=20)
        assert req.source == "newsapi"
        assert req.query == "climate change"
        assert req.limit == 20

    def test_invalid_source_rejected(self):
        from pydantic import ValidationError

        from backend.models.social_trend import BrowseArticlesRequest

        with pytest.raises(ValidationError):
            BrowseArticlesRequest(source="invalid_source")

    def test_limit_out_of_range_rejected(self):
        from pydantic import ValidationError

        from backend.models.social_trend import BrowseArticlesRequest

        with pytest.raises(ValidationError):
            BrowseArticlesRequest(limit=100)


class TestTransformArticleRequestModel:
    """Test TransformArticleRequest model validation."""

    def test_valid_request(self):
        from backend.models.social_trend import TransformArticleRequest

        req = TransformArticleRequest(
            article_name="Test Article",
            article_platform="guardian",
            article_url="https://example.com",
        )
        assert req.article_name == "Test Article"
        assert req.article_platform == "guardian"

    def test_empty_name_rejected(self):
        from pydantic import ValidationError

        from backend.models.social_trend import TransformArticleRequest

        with pytest.raises(ValidationError):
            TransformArticleRequest(article_name="", article_platform="guardian")


class TestIntegrateArticleRequestModel:
    """Test IntegrateArticleRequest model validation."""

    def test_defaults(self):
        from backend.models.social_trend import IntegrateArticleRequest

        req = IntegrateArticleRequest(title="Test Event")
        assert req.generate_reactions is True
        assert req.max_reaction_agents == 20
        assert req.impact_level == 5
        assert req.tags == []

    def test_full_request(self):
        from backend.models.social_trend import IntegrateArticleRequest

        req = IntegrateArticleRequest(
            title="Test Event",
            description="Description",
            event_type="news",
            impact_level=8,
            tags=["guardian"],
            generate_reactions=False,
            max_reaction_agents=5,
            source_article={"name": "Article", "platform": "guardian"},
        )
        assert req.generate_reactions is False
        assert req.max_reaction_agents == 5
        assert req.source_article is not None

    def test_max_agents_out_of_range_rejected(self):
        from pydantic import ValidationError

        from backend.models.social_trend import IntegrateArticleRequest

        with pytest.raises(ValidationError):
            IntegrateArticleRequest(title="Test", max_reaction_agents=100)


# ---------------------------------------------------------------------------
# Shared reaction helper test
# ---------------------------------------------------------------------------


class TestGenerateReactionsHelper:
    """Test _generate_reactions_for_event shared helper."""

    async def test_returns_empty_when_no_agents(self):
        from backend.routers.social_trends import _generate_reactions_for_event

        mock_sb = MagicMock()
        # No agents found
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )

        event = {"id": str(uuid4()), "title": "Test", "description": "Test event"}

        with patch(
            "backend.routers.social_trends.ExternalServiceResolver"
        ) as mock_resolver_cls:
            mock_resolver = MagicMock()
            mock_resolver.get_ai_provider_config = AsyncMock(
                return_value=MagicMock(openrouter_api_key="test")
            )
            mock_resolver_cls.return_value = mock_resolver

            reactions = await _generate_reactions_for_event(
                mock_sb, MOCK_SIM_ID, event, max_agents=5
            )

        assert reactions == []
