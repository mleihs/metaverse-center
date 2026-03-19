"""Cipher ARG system — code generation, hint embedding, and redemption.

Thin orchestration layer over Postgres RPCs (fn_generate_cipher_code,
fn_redeem_cipher_code) for atomic, race-condition-free validation.
"""

from __future__ import annotations

import base64
import hashlib
import logging
from uuid import UUID

import sentry_sdk

from supabase import Client

logger = logging.getLogger(__name__)


class CipherService:
    """Manages cipher code generation, hint embedding, and redemption."""

    @classmethod
    async def generate_code(
        cls,
        admin: Client,
        difficulty: str,
        simulation_id: UUID,
        entity_id: UUID | str | None = None,
    ) -> str:
        """Generate a deterministic Bureau-themed cipher code.

        Calls Postgres RPC fn_generate_cipher_code for deterministic,
        reproducible code generation from simulation + entity context.

        The entity_id ensures each post from the same simulation gets a
        unique code. Falls back to 'platform' for platform-level posts.

        Returns the unlock_code (what the user must type to redeem).
        """
        seed = f"{simulation_id}:{difficulty}:{entity_id or 'platform'}"
        response = admin.rpc(
            "fn_generate_cipher_code",
            {"p_difficulty": difficulty, "p_seed": seed},
        ).execute()

        code = response.data if isinstance(response.data, str) else str(response.data)
        logger.info("Generated cipher code", extra={
            "simulation_id": str(simulation_id),
            "entity_id": str(entity_id) if entity_id else None,
            "difficulty": difficulty,
            "code_prefix": code[:8] if code else "",
        })
        return code

    @classmethod
    async def redeem_code(
        cls,
        supabase: Client,
        code: str,
        user_id: UUID | None,
        ip_hash: str,
    ) -> dict:
        """Redeem a cipher code. All validation is in Postgres RPC.

        Returns the RPC result dict with success/error/reward info.
        """
        try:
            response = supabase.rpc(
                "fn_redeem_cipher_code",
                {
                    "p_code": code.strip().upper(),
                    "p_user_id": str(user_id) if user_id else None,
                    "p_ip_hash": ip_hash,
                },
            ).execute()

            result = response.data if isinstance(response.data, dict) else {}
            logger.info("Cipher redemption attempt", extra={
                "success": result.get("success", False),
                "error_code": result.get("error_code"),
                "user_id": str(user_id) if user_id else "anonymous",
            })
            return result

        except Exception as exc:
            logger.exception("Cipher redemption RPC failed", extra={
                "user_id": str(user_id) if user_id else "anonymous",
            })
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "cipher_redemption")
                scope.set_context("cipher", {
                    "user_id": str(user_id) if user_id else "anonymous",
                })
                sentry_sdk.capture_exception(exc)
            raise

    @classmethod
    async def get_redemption_stats(cls, admin: Client) -> dict:
        """Get aggregated cipher statistics for admin panel."""
        # Total redemptions
        redemptions_resp = (
            admin.table("cipher_redemptions")
            .select("id", count="exact")
            .execute()
        )
        total_redemptions = redemptions_resp.count or 0

        # Unique users
        users_resp = (
            admin.table("cipher_redemptions")
            .select("user_id")
            .not_.is_("user_id", "null")
            .execute()
        )
        unique_users = len({r["user_id"] for r in (users_resp.data or [])})

        # Total attempts (last 24h)
        attempts_resp = (
            admin.table("cipher_attempts")
            .select("id, success", count="exact")
            .execute()
        )
        total_attempts = attempts_resp.count or 0
        successful = sum(1 for r in (attempts_resp.data or []) if r.get("success"))
        success_rate = round(successful / total_attempts, 4) if total_attempts > 0 else 0.0

        # Recent redemptions
        recent_resp = (
            admin.table("cipher_redemptions")
            .select("*")
            .order("redeemed_at", desc=True)
            .limit(20)
            .execute()
        )

        return {
            "total_redemptions": total_redemptions,
            "unique_users": unique_users,
            "total_attempts": total_attempts,
            "success_rate": success_rate,
            "recent_redemptions": recent_resp.data or [],
        }

    @classmethod
    def prepare_cipher_for_post(
        cls,
        caption: str,
        unlock_code: str,
        difficulty: str,
        hint_format: str = "footer",
    ) -> dict[str, str | None]:
        """Prepare cipher output for a post based on hint_format setting.

        Returns:
            {"caption": str, "image_cipher": str | None}
            - For steganographic: caption gets notice text, image_cipher
              gets encoded hint for visual rendering
            - For footer/caption: delegates to embed_cipher_hint,
              image_cipher is None
        """
        if hint_format == "steganographic":
            encoded_hint = cls.encode_hint(unlock_code, difficulty)
            # Caption gets a notice instead of the actual cipher
            notice = (
                "\n\n—\nVISUAL CIPHER EMBEDDED — "
                "Decode at metaverse.center/bureau/dispatch"
            )
            disclosure = "\n\n—\nAI-generated content from metaverse.center"
            if disclosure in caption:
                result_caption = caption.replace(disclosure, notice + disclosure)
            else:
                result_caption = caption + notice

            logger.info("Prepared steganographic cipher", extra={
                "hint_format": hint_format,
                "difficulty": difficulty,
                "has_image_cipher": True,
                "hint_length": len(encoded_hint),
            })
            return {"caption": result_caption, "image_cipher": encoded_hint}

        # footer / caption — embed in caption text, no image cipher
        result_caption = cls.embed_cipher_hint(
            caption, unlock_code, difficulty, hint_format,
        )
        logger.info("Prepared caption cipher", extra={
            "hint_format": hint_format,
            "difficulty": difficulty,
            "has_image_cipher": False,
            "hint_length": len(result_caption) - len(caption),
        })
        return {"caption": result_caption, "image_cipher": None}

    @classmethod
    def encode_hint(cls, unlock_code: str, difficulty: str) -> str:
        """Encode an unlock code into a cipher hint based on difficulty.

        The hint is what appears in the Instagram caption. The user must
        decode it to discover the unlock_code.

        - easy:   Base64 of the code (simple decode)
        - medium: Caesar shift (ROT-13) then Base64
        - hard:   Reversed, Caesar shifted, then Base64
        """
        code = unlock_code.upper()

        if difficulty == "easy":
            encoded = base64.b64encode(code.encode()).decode()
            return f"CIPHER: {encoded}"

        if difficulty == "hard":
            shifted = cls._caesar_shift(code[::-1], 13)
            encoded = base64.b64encode(shifted.encode()).decode()
            return f"CIPHER-III: {encoded}"

        # medium (default)
        shifted = cls._caesar_shift(code, 13)
        encoded = base64.b64encode(shifted.encode()).decode()
        return f"CIPHER-II: {encoded}"

    @classmethod
    def embed_cipher_hint(
        cls,
        caption: str,
        unlock_code: str,
        difficulty: str,
        hint_format: str = "footer",
    ) -> str:
        """Embed a cipher hint into an Instagram caption.

        Formats:
        - footer:  Appended at the end before AI disclosure
        - caption: Inline within the caption body
        """
        hint = cls.encode_hint(unlock_code, difficulty)

        if hint_format == "caption":
            # Insert before the ADDENDUM section
            if "ADDENDUM:" in caption:
                parts = caption.split("ADDENDUM:", 1)
                return f"{parts[0]}TRANSMISSION INTERCEPT: {hint}\n\nADDENDUM:{parts[1]}"
            return f"{caption}\n\n{hint}"

        # footer (default) — append before AI disclosure
        disclosure = "\n\n—\nAI-generated content from metaverse.center"
        if disclosure in caption:
            clean = caption.replace(disclosure, "")
            return f"{clean}\n\n—\n{hint}\nDecode at metaverse.center/bureau/dispatch{disclosure}"

        return f"{caption}\n\n—\n{hint}\nDecode at metaverse.center/bureau/dispatch"

    @staticmethod
    def _caesar_shift(text: str, shift: int) -> str:
        """Apply Caesar cipher shift to alphabetic characters only."""
        result = []
        for ch in text:
            if ch.isalpha():
                base = ord("A") if ch.isupper() else ord("a")
                result.append(chr((ord(ch) - base + shift) % 26 + base))
            else:
                result.append(ch)
        return "".join(result)

    @staticmethod
    def hash_ip(ip: str) -> str:
        """SHA-256 hash of an IP address for rate limiting. No raw IPs stored."""
        return hashlib.sha256(ip.encode()).hexdigest()
