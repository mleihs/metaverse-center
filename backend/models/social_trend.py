"""Pydantic models for social trends write operations."""

from pydantic import BaseModel, Field


class SocialTrendCreate(BaseModel):
    """Schema for creating a social trend manually."""

    name: str = Field(..., min_length=1, max_length=255)
    platform: str = Field(..., min_length=1)
    raw_data: dict | None = None
    volume: int = Field(default=0, ge=0)
    url: str | None = None
    relevance_score: float | None = Field(default=None, ge=0, le=10)
    sentiment: str | None = None


class FetchTrendsRequest(BaseModel):
    """Request to fetch trends from external source."""

    source: str = Field(..., pattern=r"^(guardian|newsapi)$")
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=50)


class TransformTrendRequest(BaseModel):
    """Request to transform a trend into simulation context."""

    trend_id: str


class IntegrateTrendRequest(BaseModel):
    """Request to integrate a transformed trend as an event."""

    trend_id: str
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    event_type: str | None = None
    impact_level: int = Field(default=5, ge=1, le=10)
    tags: list[str] = Field(default_factory=list)


# --- Browse workflow models (ephemeral, no DB storage) ---


class BrowseArticlesRequest(BaseModel):
    """Request to browse/search articles from external sources without DB storage."""

    source: str = Field(default="guardian", pattern=r"^(guardian|newsapi)$")
    query: str | None = Field(default=None, max_length=500)
    section: str | None = None
    limit: int = Field(default=15, ge=1, le=50)


class TransformLens(BaseModel):
    """Wie aus einem Artikel ein Ereignis DIESER Welt wird.

    Der Schmelztiegel der Schleuse stellt diese Regler seit Schritt 3. Bis heute
    erreichte davon NICHTS das Modell — die Oberflaeche trug deshalb eine
    Fussnote und eine Marke an jeder Zeile, die nur der Erzeugung diente. Das
    ist Luecke 4 aus `handoff/schleuse-event-intake.md`, und dies ist ihr
    Verschluss.

    ⚠ NICHT ALLE Regler des Schmelztiegels stehen hier, und das ist Absicht:
    `type`, `impact` und die Reaktionen wirken bei der AUFNAHME
    (`integrate-article`), nicht bei der Erzeugung. Sie hier ZUSAETZLICH
    mitzuschicken hiesse, dem Modell einen Wert vorzugeben, den es im selben
    Aufruf auch produzieren soll — zwei Quellen fuer eine Zahl.
    """

    #: Der NAME des Ortes, nicht seine Kennung. Das Modell schreibt Prosa.
    zone_name: str | None = Field(default=None, max_length=200)
    vector: str | None = Field(default=None, max_length=50)
    tone: str | None = Field(default=None, max_length=50)
    instructions: str | None = Field(default=None, max_length=2000)
    #: 0.4 treu, 0.7 ausgewogen, 0.9 frei. Wird zur Temperatur des Aufrufs.
    creativity: float | None = Field(default=None, ge=0.0, le=2.0)


class TransformArticleRequest(BaseModel):
    """Request to transform an ephemeral article (not from DB) into simulation context."""

    article_name: str = Field(..., min_length=1, max_length=500)
    article_platform: str
    article_url: str | None = None
    article_raw_data: dict | None = None
    lens: TransformLens | None = None


class IntegrateArticleRequest(BaseModel):
    """Request to integrate an article as an event with optional reaction generation."""

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    event_type: str | None = None
    impact_level: int = Field(default=5, ge=1, le=10)
    tags: list[str] = Field(default_factory=list)
    generate_reactions: bool = True
    max_reaction_agents: int = Field(default=20, ge=1, le=50)
    source_article: dict | None = None


# --- Batch workflow models ---


class BatchArticle(BaseModel):
    """A single article in a batch operation."""

    article_name: str = Field(..., min_length=1, max_length=500)
    article_platform: str
    article_url: str | None = None
    article_raw_data: dict | None = None


class BatchTransformRequest(BaseModel):
    """Request to transform multiple articles in batch."""

    articles: list[BatchArticle] = Field(..., min_length=1, max_length=10)


class BatchIntegrateItem(BaseModel):
    """A single transformed article ready for integration."""

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    event_type: str | None = None
    impact_level: int = Field(default=5, ge=1, le=10)
    tags: list[str] = Field(default_factory=list)
    source_article: dict | None = None


class BatchIntegrateRequest(BaseModel):
    """Request to integrate multiple transformed articles as events."""

    items: list[BatchIntegrateItem] = Field(..., min_length=1, max_length=10)
    generate_reactions_for_top: bool = Field(
        default=True,
        description="Generate reactions for the highest-impact event only (cost control).",
    )
    max_reaction_agents: int = Field(default=20, ge=1, le=50)
