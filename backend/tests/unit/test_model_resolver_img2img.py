"""Tests for img2img additions to ModelResolver and ResolvedImageModel.

Covers:
1. ResolvedImageModel.is_img2img property
2. ResolvedImageModel.to_replicate_params() img2img branch
3. ModelResolver.resolve_img2img_model() fallback chain
"""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID

from backend.services.model_resolver import ModelResolver, ResolvedImageModel
from backend.tests.conftest import make_chain_mock

MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")


# ---------------------------------------------------------------------------
# ResolvedImageModel.is_img2img
# ---------------------------------------------------------------------------


class TestIsImg2Img:
    """Tests for the is_img2img property."""

    def test_true_when_reference_image_url_set(self):
        model = ResolvedImageModel(
            model="bxclib2/flux_img2img",
            reference_image_url="https://example.com/ref.avif",
        )
        assert model.is_img2img is True

    def test_false_when_reference_image_url_empty(self):
        model = ResolvedImageModel(
            model="bxclib2/flux_img2img",
            reference_image_url="",
        )
        assert model.is_img2img is False

    def test_false_when_reference_image_url_default(self):
        model = ResolvedImageModel(model="stability-ai/stable-diffusion:abc123")
        assert model.is_img2img is False


# ---------------------------------------------------------------------------
# ResolvedImageModel.to_replicate_params() — img2img branch
# ---------------------------------------------------------------------------


class TestToReplicateParamsImg2Img:
    """Tests for to_replicate_params() when is_img2img is True."""

    def test_returns_image_and_denoising_for_flux_img2img(self):
        model = ResolvedImageModel(
            model="bxclib2/flux_img2img",
            reference_image_url="https://example.com/ref.avif",
            img2img_strength=0.65,
            num_inference_steps=28,
        )
        params = model.to_replicate_params()

        assert params["image"] == "https://example.com/ref.avif"
        assert params["denoising"] == 0.65
        assert params["steps"] == 28
        # flux_img2img does not support output_format/output_quality
        assert "output_format" not in params
        assert "output_quality" not in params

    def test_prompt_param_name_for_flux_img2img(self):
        model = ResolvedImageModel(
            model="bxclib2/flux_img2img",
            reference_image_url="https://example.com/ref.avif",
        )
        assert model.prompt_param_name == "positive_prompt"

    def test_prompt_param_name_default(self):
        model = ResolvedImageModel(model="black-forest-labs/flux-dev")
        assert model.prompt_param_name == "prompt"

    def test_does_not_return_sd_specific_params(self):
        """img2img branch should not include width, height, guidance_scale, scheduler."""
        model = ResolvedImageModel(
            model="bxclib2/flux_img2img",
            reference_image_url="https://example.com/ref.avif",
            width=512,
            height=768,
            guidance_scale=7.5,
            scheduler="K_EULER",
            negative_prompt="blurry",
        )
        params = model.to_replicate_params()

        assert "width" not in params
        assert "height" not in params
        assert "guidance_scale" not in params
        assert "scheduler" not in params
        assert "negative_prompt" not in params

    def test_does_not_return_flux_specific_params(self):
        """img2img branch should not include megapixels, guidance, or aspect_ratio."""
        model = ResolvedImageModel(
            model="bxclib2/flux_img2img",
            reference_image_url="https://example.com/ref.avif",
            aspect_ratio="3:4",
        )
        params = model.to_replicate_params()

        assert "megapixels" not in params
        assert "guidance" not in params
        assert "aspect_ratio" not in params

    def test_generic_img2img_includes_aspect_ratio_when_set(self):
        """Generic (non-flux_img2img) model includes aspect_ratio."""
        model = ResolvedImageModel(
            model="other/img2img-model",
            reference_image_url="https://example.com/ref.avif",
            aspect_ratio="3:4",
        )
        params = model.to_replicate_params()

        assert params["aspect_ratio"] == "3:4"
        assert params["prompt_strength"] == 0.75  # generic uses prompt_strength

    def test_generic_img2img_omits_aspect_ratio_when_empty(self):
        model = ResolvedImageModel(
            model="other/img2img-model",
            reference_image_url="https://example.com/ref.avif",
            aspect_ratio="",
        )
        params = model.to_replicate_params()

        assert "aspect_ratio" not in params

    def test_generic_img2img_default_output_format_fallback(self):
        """When output_format is empty, generic img2img falls back to 'png'."""
        model = ResolvedImageModel(
            model="other/img2img-model",
            reference_image_url="https://example.com/ref.avif",
            output_format="",
        )
        params = model.to_replicate_params()

        assert params["output_format"] == "png"


# ---------------------------------------------------------------------------
# Comparison: non-img2img Flux params
# ---------------------------------------------------------------------------


class TestToReplicateParamsFluxNonImg2Img:
    """Verify Flux (non-img2img) path still works correctly."""

    def test_flux_params_include_megapixels_and_guidance(self):
        model = ResolvedImageModel(
            model="black-forest-labs/flux-dev",
            guidance_scale=3.5,
            num_inference_steps=28,
            aspect_ratio="3:4",
            output_format="png",
            output_quality=100,
        )
        params = model.to_replicate_params()

        assert params["megapixels"] == "1"
        assert params["guidance"] == 3.5
        assert "image" not in params
        assert "prompt_strength" not in params


# ---------------------------------------------------------------------------
# ModelResolver.resolve_img2img_model()
# ---------------------------------------------------------------------------


class TestResolveImg2ImgModel:
    """Tests for ModelResolver.resolve_img2img_model()."""

    async def test_uses_setting_when_configured(self):
        """Uses image_ref_model from simulation settings."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(
            execute_data=[
                {"setting_key": "image_ref_model", "setting_value": "custom/img2img-model"},
                {"setting_key": "image_guidance_scale", "setting_value": "4.0"},
                {"setting_key": "image_num_inference_steps", "setting_value": "32"},
            ],
        )

        resolver = ModelResolver(mock_sb, MOCK_SIM_ID)
        result = await resolver.resolve_img2img_model("agent_portrait")

        assert result.model == "custom/img2img-model"
        assert result.source == "img2img"
        assert result.guidance_scale == 4.0
        assert result.num_inference_steps == 32

    async def test_falls_back_to_default_model(self):
        """Falls back to 'bxclib2/flux_img2img' when no setting configured."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(execute_data=[])

        resolver = ModelResolver(mock_sb, MOCK_SIM_ID)
        result = await resolver.resolve_img2img_model("agent_portrait")

        assert "bxclib2/flux_img2img" in result.model
        assert result.source == "img2img"

    async def test_portrait_purpose_gets_portrait_aspect_ratio(self):
        """Purpose containing 'portrait' resolves to portrait aspect ratio."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(execute_data=[])

        resolver = ModelResolver(mock_sb, MOCK_SIM_ID)
        result = await resolver.resolve_img2img_model("agent_portrait")

        assert result.aspect_ratio == "3:4"

    async def test_building_purpose_gets_building_aspect_ratio(self):
        """Purpose without 'portrait' resolves to building aspect ratio."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(execute_data=[])

        resolver = ModelResolver(mock_sb, MOCK_SIM_ID)
        result = await resolver.resolve_img2img_model("building_image")

        assert result.aspect_ratio == "4:3"

    async def test_respects_custom_output_format(self):
        """Custom output format from settings is used."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(
            execute_data=[
                {"setting_key": "image_output_format", "setting_value": "webp"},
            ],
        )

        resolver = ModelResolver(mock_sb, MOCK_SIM_ID)
        result = await resolver.resolve_img2img_model("agent_portrait")

        assert result.output_format == "webp"

    async def test_caches_settings_across_calls(self):
        """Second call reuses cached settings (no second DB query)."""
        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        mock_sb.table.return_value = chain

        resolver = ModelResolver(mock_sb, MOCK_SIM_ID)
        await resolver.resolve_img2img_model("agent_portrait")
        await resolver.resolve_img2img_model("building_image")

        # table().select()...execute() should only be called once
        assert chain.execute.call_count == 1
