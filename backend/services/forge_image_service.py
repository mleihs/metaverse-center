"""End-to-end image generation pipeline."""

from __future__ import annotations

import asyncio
import io
import logging
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from backend.services.ai_usage_service import AIUsageService
from backend.services.ai_utils import key_source_for
from backend.services.external.replicate import ReplicateService
from backend.services.generation_service import GenerationService
from backend.services.image_content_policy import ContentRating
from backend.services.image_prompt_budget import fit_to_token_budget, tokenbudget, wortbudget
from backend.services.model_resolver import ModelResolver, ResolvedImageModel
from backend.services.style_reference_service import StyleReferenceService
from backend.utils.image import AVIF_QUALITY, AVIF_QUALITY_THUMB, MAX_IMAGE_DIMENSION, convert_to_avif
from backend.utils.responses import extract_list
from backend.utils.safe_fetch import safe_download
from supabase import AsyncClient as Client

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage

logger = logging.getLogger(__name__)


async def _lade_beste_aufloesung(
    url: str,
    allowed: set[str],
) -> tuple[bytes, str]:
    """Die grosse Fassung eines eigenen Speicherbildes holen, sonst die verlinkte.

    `_upload_dual_resolution` legt JEDES erzeugte Bild zweimal ab:

        {uuid}.full.avif   native Aufloesung, Qualitaet 85
        {uuid}.avif        laengste Kante 1024, Qualitaet 80

    und gibt die KLEINE zurueck. Sie steht deshalb in
    `agents.portrait_image_url`, `buildings.image_url` und ueberall sonst — sie
    ist die richtige Wahl fuer eine Seite, die geladen werden soll.

    Fuer eine Bildvorlage ist sie die falsche. An zwoelf Prod-Portraeten am
    05.09.2026 gemessen: wo das Original ueber 1024 lag, ist die grosse Fassung
    880x1168 gegen 772x1024 und traegt rund die doppelte Datenmenge; wo es
    darunter lag, sind beide dieselbe Datei. Es gibt also nichts zu verlieren
    und in der Mehrzahl der Faelle Auflösung zu gewinnen — die ein
    Bildmodell an einem Gesicht unmittelbar in Aehnlichkeit umsetzt.

    Eine rohe PNG-Fassung gibt es nicht: `convert_to_avif` wandelt die Antwort
    des Modells um, und die Rohdaten werden nicht abgelegt. `{uuid}.full.avif`
    IST das Beste, was der Speicher hat.

    Faellt still auf die uebergebene URL zurueck: eine fremde Stilvorlage folgt
    unserer Namenskonvention nicht, und ein alter Eintrag hat vielleicht keine
    grosse Fassung. Beides ist kein Fehler, sondern der Normalfall ausserhalb
    unseres eigenen Speichers.
    """
    if url.endswith(".avif") and not url.endswith(".full.avif"):
        gross = url[: -len(".avif")] + ".full.avif"
        try:
            return await safe_download(gross, allowed_content_types=allowed)
        except Exception as fehler:  # noqa: BLE001 — jeder Grund fuehrt zum Rueckfall
            logger.debug(
                "Full-resolution reference not available, using the linked one",
                extra={"url": gross, "error": str(fehler)},
            )
    return await safe_download(url, allowed_content_types=allowed)


def _auf_vielfaches_von_16(img: PILImage) -> PILImage:
    """Kantenlaengen auf ein Vielfaches von 16 bringen, nach unten.

    Ein Latent-Diffusion-Modell zerlegt das Bild in Bloecke; passt die
    Kantenlaenge nicht auf, bricht es ab. `bxclib2/flux_img2img` — das Modell
    des Forge-Stilreferenzpfades — meldet dann keinen Massfehler, sondern

        Error while processing rearrange-reduction pattern "b c (h ph) (w pw)"

    also eine Zeile aus dem Inneren einer Bibliothek, die niemand als
    „das Bild ist vier Pixel zu breit" liest.

    Und es trifft nicht den Randfall, sondern den Normalfall: von 25
    Portraeten auf Produktion (05.09.2026) sind 23 nicht durch 16 teilbar —
    772x1024 sechzehnmal, 796x1024 siebenmal. Der Stilreferenzpfad scheiterte
    damit an fast jedem Portraet, seit es ihn gibt.

    Verkleinern und nicht zuschneiden: bei 772 -> 768 sind das 0,5 Prozent
    Massstab, waehrend ein Schnitt vier Pixel Bildinhalt kostet. Bei einem
    Gesicht als Vorlage wiegt der ganze Ausschnitt mehr als ein halbes Prozent
    Seitenverhaeltnis. Nach unten — nach oben waeren es erfundene Pixel.

    Die eine Ausnahme steht ausdruecklich da, statt sich aus `max()` zu
    ergeben: unter 16 Pixel gibt es kein kleineres Vielfaches als 0, also
    waere „nach unten" ein leeres Bild. Solche Kanten werden auf 16 gehoben.
    Ein Bild dieser Groesse ist als Vorlage ohnehin wertlos — aber ein
    hochskaliertes Nichts ist ein Bild, ein leeres ist ein Absturz.
    """
    from PIL import Image

    b, h = img.size
    neu = (max(16, b - b % 16), max(16, h - h % 16))
    return img if neu == (b, h) else img.resize(neu, Image.LANCZOS)


class ForgeImageService:
    """Orchestrates image generation: description -> Replicate -> AVIF -> Storage."""

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        replicate_api_key: str | None = None,
        openrouter_api_key: str | None = None,
        world_context: str = "",
        key_source: str = "platform",
    ):
        """``key_source`` must be STATED, not inferred from the key being set.

        Two different chains reach this constructor with a non-empty
        ``replicate_api_key`` and they mean opposite things for the ledger: the
        Forge orchestrator passes the user's OWN key (``byok`` — the platform
        pays nothing), while ``routers/generation.py`` passes whatever
        ``ExternalServiceResolver`` produced, which is a simulation override,
        a platform setting or the ``.env`` value, and is always the platform's
        money. ``key_source_for()`` cannot tell those apart, so callers that
        know say so and the default stays the conservative ``"platform"``.
        (The resolver discards which of its three rungs answered, so the
        generation path cannot yet distinguish ``simulation`` from ``env``; it
        is recorded as ``platform``, which is true of who pays.)
        """
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._key_source = key_source
        self._replicate = ReplicateService(api_key=replicate_api_key)
        self._generation = GenerationService(
            supabase,
            simulation_id,
            openrouter_api_key=openrouter_api_key,
            world_context=world_context,
        )

        self._model_resolver = ModelResolver(supabase, simulation_id)

    @staticmethod
    def _sanitize_prompt(description: str) -> str:
        """Strip markdown formatting and meta-text from AI-generated image prompts.

        DeepSeek sometimes wraps descriptions in markdown (``**bold**``,
        ``## headings``, ``- lists``) which confuses Replicate's content
        filter and produces worse images.  This method extracts the raw
        descriptive text.
        """
        import re

        # Remove markdown bold/italic markers
        text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", description)
        # Remove markdown headings
        text = re.sub(r"^#{1,4}\s*", "", text, flags=re.MULTILINE)
        # Remove markdown list markers
        text = re.sub(r"^[-*]\s+", "", text, flags=re.MULTILINE)
        # Remove "Image Generation Prompt:" meta-text
        text = re.sub(r"(?i)image generation prompt:?\s*", "", text)
        # Collapse excessive whitespace
        text = re.sub(r"\n{2,}", "\n", text).strip()
        return text

    async def _log_image_usage(self, model: str, purpose: str, api_key: str | None = None) -> None:
        """Fire-and-forget Replicate usage logging.

        ``api_key`` is the per-call override the portrait and building methods
        accept. When one is given it is by definition the caller's own key —
        the platform key never travels that way — so it outranks the
        constructor's ``key_source``.
        """
        await AIUsageService.log(
            self._supabase,
            simulation_id=self._simulation_id,
            provider="replicate",
            model=model,
            purpose=purpose,
            key_source=key_source_for(api_key) if api_key else self._key_source,
        )

    @staticmethod
    async def _download_reference_image(url: str, *, name: str = "reference.png") -> io.BytesIO:
        """Download a reference image with SSRF protection, convert to PNG.

        Uses ``safe_download`` (``backend/utils/safe_fetch``) to validate the
        URL before fetching.  Two conversions happen:

        1. Replicate runs remotely and cannot access local URLs
           (e.g. localhost Supabase storage), so we download the image.
        2. Storage uses AVIF for efficiency, but many Replicate models
           only support PNG/JPEG/WebP — convert to PNG for compatibility.
        3. Die Kantenlaengen werden auf ein Vielfaches von 16 gebracht. Siehe
           `_auf_vielfaches_von_16` — ohne das scheitert der Forge-Stilpfad an
           fast jedem echten Portraet.
        4. Geholt wird die GROSSE Fassung, nicht die verlinkte. Siehe
           `_lade_beste_aufloesung`.
        """
        from PIL import Image

        allowed = {"image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"}
        data, _ = await _lade_beste_aufloesung(url, allowed)
        img = Image.open(io.BytesIO(data))
        img = _auf_vielfaches_von_16(img)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        buf.name = name  # Replicate SDK uses .name for content-type
        return buf

    async def _materialise_references(
        self,
        image_model: ResolvedImageModel,
        params: dict,
    ) -> dict:
        """Referenz-URLs durch PNG-Puffer ersetzen, am Feld DIESER Familie.

        Ohne diesen Schritt reicht der Aufrufer eine Speicher-URL durch, und
        was dann passiert, haengt vom Modell ab — was heisst: es ist nicht
        vorherzusehen, sondern nur zu messen. Am 05.09.2026 gegen ein echtes
        Portraet aus dem Speicher (AVIF, wie jedes dort) gelaufen:

            black-forest-labs/flux-dev      succeeded
            bxclib2/flux_img2img            failed  cannot identify image file
            datacte/proteus-v0.2            failed  cannot identify image file
            asiryan/juggernaut-xl-v7        failed  cannot identify image file

        Drei von vier scheitern, und zwar an der Bildbibliothek IM Modell, die
        AVIF nicht liest. Unser Speicher ist durchgehend AVIF — die ganze
        Erwachsenenspur haette also nie ein Bild geliefert, mit einer Meldung,
        die von einem kaputten Bild spricht statt von einem Format.

        Der Feldname kommt aus der Familie und nicht als Zeichenkette von hier:
        er heisst `image` bei den SD-Abkoemmlingen, `input_images` bei Flux 2
        und `image_prompt` bei Flux 1.1 Pro. Zwei bestehende Aufrufer setzten
        `params["image"]` fest — richtig fuer das Modell, das sie heute
        aufloesen, und still falsch, sobald jemand die Einstellung aendert.
        """
        feld = image_model.family.reference_field
        if not feld or feld not in params:
            return params
        if image_model.family.reference == "list":
            params[feld] = [
                await self._download_reference_image(u, name=f"reference-{i}.png")
                for i, u in enumerate(params[feld])
            ]
        else:
            params[feld] = await self._download_reference_image(params[feld])
        return params

    async def generate_entity_image(
        self,
        entity_type: str,
        entity_id: UUID,
        entity_name: str,
        extra: dict | None = None,
    ) -> str:
        """Generate an image for an agent portrait, building, or banner.

        Owns the request-payload shaping the generation router previously did
        inline (popping ``description_override`` and, for buildings, assembling
        the ``building_data`` field set), so the controller stays HTTP-only.
        ``entity_type`` other than "agent"/"banner" is treated as a building.
        """
        extra = dict(extra or {})
        description_override = extra.pop("description_override", None)

        if entity_type == "agent":
            return await self.generate_agent_portrait(
                agent_id=entity_id,
                agent_name=entity_name,
                agent_data=extra or None,
                description_override=description_override,
            )
        if entity_type == "banner":
            return await self.generate_banner_image(
                sim_name=entity_name,
                sim_description=extra.get("description", ""),
                anchor_data=extra.get("anchor_data"),
            )

        building_data = {
            "building_condition": extra.get("building_condition", ""),
            "building_style": extra.get("building_style", ""),
            "description": extra.get("description", ""),
            "special_type": extra.get("special_type", ""),
            "construction_year": extra.get("construction_year", ""),
            "population_capacity": extra.get("population_capacity", ""),
            "zone_name": extra.get("zone_name", ""),
            "embassy_id": extra.get("embassy_id", ""),
            "partner_simulation_id": extra.get("partner_simulation_id", ""),
            "special_attributes": extra.get("special_attributes"),
        }
        return await self.generate_building_image(
            building_id=entity_id,
            building_name=entity_name,
            building_type=extra.get("building_type", "residential"),
            building_data=building_data,
            description_override=description_override,
        )

    async def generate_agent_portrait(
        self,
        agent_id: UUID,
        agent_name: str,
        agent_data: dict | None = None,
        description_override: str | None = None,
        api_key: str | None = None,
    ) -> str:
        """Generate a portrait for an agent and upload to storage."""
        replicate_client = ReplicateService(api_key=api_key) if api_key else self._replicate
        data = agent_data or {}

        if description_override:
            description = description_override
            logger.debug(
                "Using description override for agent",
                extra={"entity_type": "agent", "entity_id": str(agent_id)},
            )
        elif data.get("is_ambassador"):
            description = await self._generate_ambassador_description(
                agent_name,
                data,
            )
        else:
            description = await self._generation.generate_portrait_description(
                agent_name=agent_name,
                agent_data=agent_data,
                locale="en",
            )

        logger.debug("Portrait description generated", extra={"entity_type": "agent", "entity_id": str(agent_id)})

        # 2. Sanitize AI-generated description (strip markdown, meta-text)
        description = self._sanitize_prompt(description)

        # 3. Append style prompt from settings
        style_prompt = await self._model_resolver.resolve_style_prompt("portrait")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        # 3. Resolve style reference (img2img) or standard model
        ref = await StyleReferenceService.resolve_reference(
            self._supabase,
            self._simulation_id,
            "portrait",
            agent_id,
        )
        if ref:
            image_model = await self._model_resolver.resolve_img2img_model("agent_portrait")
            image_model.reference_image_url = ref["url"]
            image_model.img2img_strength = ref["strength"]
            logger.info(
                "Using img2img with style reference",
                extra={"entity_type": "agent", "entity_id": str(agent_id), "scope": ref["scope"]},
            )
            # Die Referenz wird heruntergeladen und nach PNG gewandelt: die
            # Modelle laufen entfernt und erreichen eine lokale Speicher-URL
            # nicht, und AVIF liest die Mehrzahl von ihnen ohnehin nicht.
            params = await self._materialise_references(
                image_model,
                image_model.to_replicate_params(),
            )
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **params,
            )
        else:
            image_model = await self._model_resolver.resolve_image_model(
                "agent_portrait",
            )
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **image_model.to_replicate_params(),
            )

        # 4. Upload dual-resolution AVIF (full-res + thumbnail)
        filename = f"{self._simulation_id}/{agent_id}/{uuid4()}.avif"
        url = await self._upload_dual_resolution(
            bucket="agent.portraits",
            base_path=filename,
            raw_bytes=raw_bytes,
        )

        # 5. Update agent record (persist both URL and description for debugging)
        await (
            self._supabase.table("agents")
            .update(
                {"portrait_image_url": url, "portrait_description": description[:2000]},
            )
            .eq("id", str(agent_id))
            .execute()
        )

        await self._log_image_usage(image_model.model, "portrait", api_key)
        logger.info("Portrait uploaded", extra={"entity_type": "agent", "entity_id": str(agent_id), "path": url})
        return url

    async def generate_building_image(
        self,
        building_id: UUID,
        building_name: str,
        building_type: str,
        building_data: dict | None = None,
        description_override: str | None = None,
        api_key: str | None = None,
    ) -> str:
        """Generate an image for a building and upload to storage."""
        replicate_client = ReplicateService(api_key=api_key) if api_key else self._replicate
        data = building_data or {}

        if description_override:
            description = description_override
            logger.debug(
                "Using description override for building",
                extra={"entity_type": "building", "entity_id": str(building_id)},
            )
        elif data.get("special_type") == "embassy":
            description = await self._generate_embassy_description(
                building_name,
                data,
            )
        else:
            description = await self._generation.generate_building_image_description(
                building_name=building_name,
                building_type=building_type,
                building_data=building_data,
            )

        logger.debug(
            "Building image description generated",
            extra={"entity_type": "building", "entity_id": str(building_id)},
        )

        # 2. Sanitize AI-generated description (strip markdown, meta-text)
        description = self._sanitize_prompt(description)

        # 3. Append style prompt from settings
        style_prompt = await self._model_resolver.resolve_style_prompt("building")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        # 3. Resolve style reference (img2img) or standard model
        ref = await StyleReferenceService.resolve_reference(
            self._supabase,
            self._simulation_id,
            "building",
            building_id,
        )
        if ref:
            image_model = await self._model_resolver.resolve_img2img_model("building_image")
            image_model.reference_image_url = ref["url"]
            image_model.img2img_strength = ref["strength"]
            logger.info(
                "Using img2img with style reference",
                extra={"entity_type": "building", "entity_id": str(building_id), "scope": ref["scope"]},
            )
            # Die Referenz wird heruntergeladen und nach PNG gewandelt: die
            # Modelle laufen entfernt und erreichen eine lokale Speicher-URL
            # nicht, und AVIF liest die Mehrzahl von ihnen ohnehin nicht.
            params = await self._materialise_references(
                image_model,
                image_model.to_replicate_params(),
            )
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **params,
            )
        else:
            image_model = await self._model_resolver.resolve_image_model(
                "building_image",
            )
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **image_model.to_replicate_params(),
            )

        # 4. Upload dual-resolution AVIF (full-res + thumbnail)
        filename = f"{self._simulation_id}/{building_id}/{uuid4()}.avif"
        url = await self._upload_dual_resolution(
            bucket="building.images",
            base_path=filename,
            raw_bytes=raw_bytes,
        )

        # 5. Update building record (persist both URL and prompt for debugging)
        await (
            self._supabase.table("buildings")
            .update(
                {"image_url": url, "image_prompt_text": description[:2000]},
            )
            .eq("id", str(building_id))
            .execute()
        )

        await self._log_image_usage(image_model.model, "building", api_key)
        logger.info("Image uploaded", extra={"entity_type": "building", "entity_id": str(building_id), "path": url})
        return url

    async def generate_banner_image(
        self,
        sim_name: str,
        sim_description: str,
        anchor_data: dict | None = None,
    ) -> str:
        """Generate a 16:9 banner image for a simulation and upload to storage.

        Uses the banner_description prompt template (via GenerationService)
        so each simulation can define its own banner art direction — matching
        the same per-simulation customization used for portraits and buildings.
        """
        # Fetch zone descriptions for thematic context
        zones_resp = await (
            self._supabase.table("zones")
            .select("name, description")
            .eq("simulation_id", str(self._simulation_id))
            .limit(10)
            .execute()
        )
        zone_summaries = [f"{z['name']}: {z['description']}" for z in extract_list(zones_resp) if z.get("description")]

        description = await self._generation.generate_banner_description(
            sim_name=sim_name,
            sim_description=sim_description,
            zone_summaries=zone_summaries,
            anchor_data=anchor_data,
        )

        description = self._sanitize_prompt(description)

        style_prompt = await self._model_resolver.resolve_style_prompt("banner")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        image_model = await self._model_resolver.resolve_image_model("banner")
        params = image_model.to_replicate_params()
        params["aspect_ratio"] = "16:9"

        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            **params,
        )

        filename = f"{self._simulation_id}/banner/{uuid4()}.avif"
        url = await self._upload_dual_resolution(
            bucket="simulation.assets",
            base_path=filename,
            raw_bytes=raw_bytes,
        )

        await (
            self._supabase.table("simulations")
            .update(
                {"banner_url": url},
            )
            .eq("id", str(self._simulation_id))
            .execute()
        )

        await self._log_image_usage("replicate/image-model", "banner")
        logger.info(
            "Banner uploaded",
            extra={"entity_type": "banner", "simulation_id": str(self._simulation_id), "path": url},
        )
        return url

    async def generate_lore_image(
        self,
        section_title: str,
        section_body: str,
        image_slug: str,
        sim_slug: str,
        section_id: str | None = None,
        image_caption: str | None = None,
    ) -> str:
        """Generate a 3:2 atmospheric lore image and upload to storage.

        Uploads to simulation.assets/{sim_slug}/lore/{image_slug}.avif
        matching the LoreScroll._getImageUrl() path convention.

        When image_caption is provided (written during lore creation as a
        visual description specifically for image generation), it is used
        directly as the Replicate prompt — no LLM re-generation needed.
        Falls back to LLM-powered description from section body otherwise.
        """
        if image_caption:
            description = image_caption
        else:
            description = await self._generation.generate_lore_image_description(
                section_title=section_title,
                section_body=section_body,
            )

        description = self._sanitize_prompt(description)

        style_prompt = await self._model_resolver.resolve_style_prompt("lore")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        image_model = await self._model_resolver.resolve_image_model("lore_image")
        params = image_model.to_replicate_params()
        params["aspect_ratio"] = "3:2"

        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            prompt_key=image_model.prompt_param_name,
            **params,
        )

        # Upload path matches LoreScroll convention: /{sim_slug}/lore/{image_slug}.avif
        # AVIF encodes are CPU-bound (0.1-5s each) — off the event loop (P1-6).
        path = f"{sim_slug}/lore/{image_slug}.avif"
        full_avif = await asyncio.to_thread(convert_to_avif, raw_bytes, max_dimension=None, quality=AVIF_QUALITY)
        thumb_avif = await asyncio.to_thread(
            convert_to_avif, raw_bytes, max_dimension=MAX_IMAGE_DIMENSION, quality=AVIF_QUALITY_THUMB
        )

        full_path = path.replace(".avif", ".full.avif")
        await self._upload_to_storage("simulation.assets", full_path, full_avif)
        url = await self._upload_to_storage("simulation.assets", path, thumb_avif)

        # Mark section AFTER upload succeeds — prevents orphaned DB state
        # where image_generated_at is set but no file exists in storage.
        if section_id:
            await (
                self._supabase.table("simulation_lore")
                .update(
                    {"image_generated_at": "now()"},
                )
                .eq("id", section_id)
                .execute()
            )

        await self._log_image_usage(image_model.model, "lore_image")
        logger.info("Lore image uploaded", extra={"entity_type": "lore", "path": url})
        return url

    async def generate_scene_image(
        self,
        *,
        description: str,
        references: list[str],
        rating: ContentRating,
        conversation_id: UUID,
    ) -> str:
        """Ein Szenenbild aus dem Gespraech, mit den Gesichtern der Welt.

        DER UNTERSCHIED ZU ALLEN ANDEREN BILDERN HIER: mehrere Referenzen.
        `flux-2` nimmt sie als Liste (`input_images`) und ist ausdruecklich
        dafuer gebaut, dieselbe Figur ueber verschiedene Erzeugungen zu halten
        — genau das, was eine Szene mit drei Figuren braucht. Die uebrigen
        Wege in dieser Datei kommen mit einer Referenz aus und weichen deshalb
        auf ein Gemeinschaftsmodell mit EINEM Bild aus.

        Wie viele durchgehen, entscheidet die Modellfamilie und nicht diese
        Methode: `ResolvedImageModel.references` kappt auf `max_references`.
        Bei einem Modell, das nur eines nimmt, ist das die erste Figur der
        Spanne — schlechter als acht, aber richtig.
        """
        description = self._sanitize_prompt(description)

        image_model = await self._model_resolver.resolve_image_model("scene", rating=rating)

        # Erst das Modell, dann der Prompt — und in DIESER Reihenfolge, weil
        # das Modell sagt, wie viel Text ueberhaupt ankommt.
        #
        # Die SDXL-Spur kodiert mit CLIP und fasst 77 Token; was darueber
        # steht, wird abgeschnitten, ohne Fehler und ohne Spur in der Antwort
        # (siehe `image_prompt_budget`). Vorher wurde hier erst der Stilprompt
        # angehaengt und dann alles abgeschickt: von rund 160 Woertern kamen
        # 60 an, und weggefallen ist das ENDE — dort, wo die dritte Figur und
        # der Bildausschnitt stehen.
        #
        # Der Stilprompt geht deshalb zuerst ueber die Klinge und nicht die
        # Beschreibung. Er ist die Handschrift der Welt; sie ist das Bild.
        grenze = image_model.family.clip_token_limit
        if grenze:
            description = fit_to_token_budget(description, grenze, was="scene_description")

        style_prompt = await self._model_resolver.resolve_style_prompt("scene")
        if style_prompt:
            if grenze:
                # Was nach der Beschreibung noch frei ist, bekommt der Stil.
                rest = wortbudget(grenze) - len(description.split())
                style_prompt = (
                    fit_to_token_budget(style_prompt, tokenbudget(rest), was="scene_style")
                    if rest > 0
                    else ""
                )
            if style_prompt:
                description = f"{description}, {style_prompt}"

        if references:
            image_model.reference_image_url = references[0]
            image_model.extra_reference_urls = tuple(references[1:])
        # Die Toleranz setzt der Aufloeser, er kennt die Stufe. Hier stand sie
        # frueher als `5 if MATURE else 2` — mit einem Kommentar, der behauptete,
        # sie komme aus `image_safety_tolerance_*`. Jetzt tut sie es wirklich,
        # und zwar fuer jeden Aufrufer und nicht nur fuer diesen.

        params = await self._materialise_references(
            image_model,
            image_model.to_replicate_params(),
        )
        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            prompt_key=image_model.prompt_param_name,
            **params,
        )

        # AVIF-Wandlung ist CPU-gebunden (0,1-5 s) und gehoert vom Ereignisband
        # herunter — dieselbe Begruendung wie bei `generate_lore_image` (P1-6).
        path = f"chat/{conversation_id}/{uuid4().hex}.avif"
        full_avif = await asyncio.to_thread(convert_to_avif, raw_bytes, max_dimension=None, quality=AVIF_QUALITY)
        thumb_avif = await asyncio.to_thread(
            convert_to_avif, raw_bytes, max_dimension=MAX_IMAGE_DIMENSION, quality=AVIF_QUALITY_THUMB
        )
        await self._upload_to_storage("simulation.assets", path.replace(".avif", ".full.avif"), full_avif)
        url = await self._upload_to_storage("simulation.assets", path, thumb_avif)

        await self._log_image_usage(image_model.model, "scene_image")
        logger.info(
            "Scene image uploaded",
            extra={
                "conversation_id": str(conversation_id),
                "references": len(image_model.references),
                "rating": rating.value,
                "model": image_model.model,
            },
        )
        return url

    async def _generate_embassy_description(
        self,
        building_name: str,
        building_data: dict,
    ) -> str:
        """Fetch embassy context and generate an embassy building image description."""
        embassy_id = building_data.get("embassy_id")
        if not embassy_id:
            # Try to find embassy via special_attributes
            attrs = building_data.get("special_attributes") or {}
            embassy_id = attrs.get("embassy_id")

        if not embassy_id:
            logger.warning(
                "Embassy building '%s' has no embassy_id – falling back to standard",
                building_name,
            )
            return await self._generation.generate_building_image_description(
                building_name=building_name,
                building_type=building_data.get("building_type", ""),
                building_data=building_data,
            )

        # Fetch embassy record
        embassy_resp = await self._supabase.table("embassies").select("*").eq("id", str(embassy_id)).limit(1).execute()
        if not embassy_resp.data:
            logger.warning("Embassy %s not found – falling back to standard", embassy_id)
            return await self._generation.generate_building_image_description(
                building_name=building_name,
                building_type=building_data.get("building_type", ""),
                building_data=building_data,
            )

        embassy = embassy_resp.data[0]

        # Determine partner simulation ID
        partner_sim_id = building_data.get("partner_simulation_id")
        if not partner_sim_id:
            attrs = building_data.get("special_attributes") or {}
            partner_sim_id = attrs.get("partner_simulation_id")
        if not partner_sim_id:
            # Derive from embassy: the partner is whichever sim is not ours
            if str(embassy["simulation_a_id"]) == str(self._simulation_id):
                partner_sim_id = embassy["simulation_b_id"]
            else:
                partner_sim_id = embassy["simulation_a_id"]

        # Fetch partner simulation name
        partner_resp = await (
            self._supabase.table("simulations").select("name").eq("id", str(partner_sim_id)).limit(1).execute()
        )
        partner_name = partner_resp.data[0]["name"] if partner_resp.data else "Unknown"

        # Fetch partner style prompt
        partner_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(partner_sim_id))
            .eq("setting_key", "ai.image_style_prompt_building")
            .limit(1)
            .execute()
        )
        partner_theme = partner_style_resp.data[0]["setting_value"] if partner_style_resp.data else ""

        # Fetch our own style prompt for the template
        own_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "ai.image_style_prompt_building")
            .limit(1)
            .execute()
        )
        own_theme = own_style_resp.data[0]["setting_value"] if own_style_resp.data else ""

        building_data_with_theme = {**building_data, "simulation_theme": own_theme}

        return await self._generation.generate_embassy_building_image_description(
            building_name=building_name,
            building_data=building_data_with_theme,
            partner_simulation={"name": partner_name, "theme": partner_theme},
            embassy_data=embassy,
        )

    async def _generate_ambassador_description(
        self,
        agent_name: str,
        agent_data: dict,
    ) -> str:
        """Fetch embassy context and generate an ambassador portrait description."""
        # Find the first embassy this agent is associated with via embassy_metadata
        # Ambassadors are named in embassy_metadata.ambassador_a/b.name
        embassy_resp = await (
            self._supabase.table("embassies")
            .select("*")
            .or_(
                f"simulation_a_id.eq.{self._simulation_id},simulation_b_id.eq.{self._simulation_id}",
            )
            .eq("status", "active")
            .limit(1)
            .execute()
        )

        if not embassy_resp.data:
            logger.warning(
                "No embassy found for ambassador '%s' – falling back to standard",
                agent_name,
            )
            return await self._generation.generate_portrait_description(
                agent_name=agent_name,
                agent_data=agent_data,
                locale="en",
            )

        embassy = embassy_resp.data[0]

        # Determine partner simulation
        if str(embassy["simulation_a_id"]) == str(self._simulation_id):
            partner_sim_id = embassy["simulation_b_id"]
        else:
            partner_sim_id = embassy["simulation_a_id"]

        # Fetch partner simulation name
        partner_resp = await (
            self._supabase.table("simulations").select("name").eq("id", str(partner_sim_id)).limit(1).execute()
        )
        partner_name = partner_resp.data[0]["name"] if partner_resp.data else "Unknown"

        # Fetch partner style prompt (portrait)
        partner_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(partner_sim_id))
            .eq("setting_key", "ai.image_style_prompt_portrait")
            .limit(1)
            .execute()
        )
        partner_theme = partner_style_resp.data[0]["setting_value"] if partner_style_resp.data else ""

        # Fetch our own style prompt
        own_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "ai.image_style_prompt_portrait")
            .limit(1)
            .execute()
        )
        own_theme = own_style_resp.data[0]["setting_value"] if own_style_resp.data else ""

        agent_data_with_theme = {**agent_data, "simulation_theme": own_theme}

        return await self._generation.generate_ambassador_portrait_description(
            agent_name=agent_name,
            agent_data=agent_data_with_theme,
            partner_simulation={"name": partner_name, "theme": partner_theme},
            embassy_data=embassy,
        )

    async def _upload_dual_resolution(
        self,
        bucket: str,
        base_path: str,
        raw_bytes: bytes,
    ) -> str:
        """Upload full-res + thumbnail AVIF. Returns thumbnail URL.

        Full-res file: {uuid}.full.avif (native resolution, quality 85)
        Thumbnail file: {uuid}.avif (max 1024px, quality 80)
        """
        # AVIF encodes are CPU-bound (0.1-5s each) — off the event loop (P1-6).
        full_avif = await asyncio.to_thread(
            convert_to_avif,
            raw_bytes,
            max_dimension=None,
            quality=AVIF_QUALITY,
        )
        thumb_avif = await asyncio.to_thread(
            convert_to_avif,
            raw_bytes,
            max_dimension=MAX_IMAGE_DIMENSION,
            quality=AVIF_QUALITY_THUMB,
        )

        full_path = base_path.replace(".avif", ".full.avif")
        await self._upload_to_storage(bucket, full_path, full_avif)
        thumb_url = await self._upload_to_storage(bucket, base_path, thumb_avif)

        logger.debug(
            "Dual upload complete",
            extra={"path": base_path, "thumb_bytes": len(thumb_avif), "full_bytes": len(full_avif)},
        )
        return thumb_url

    async def _upload_to_storage(
        self,
        bucket: str,
        path: str,
        data: bytes,
    ) -> str:
        """Upload file to Supabase Storage and return the public URL."""
        await self._supabase.storage.from_(bucket).upload(
            path,
            data,
            {"content-type": "image/avif", "upsert": "true"},
        )

        result = await self._supabase.storage.from_(bucket).get_public_url(path)
        return result
