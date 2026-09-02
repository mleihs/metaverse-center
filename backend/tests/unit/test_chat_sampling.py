"""Die Regler des Gesprächszugs — und warum sie so stehen.

Der Chat umging bis 02.09.2026 die Zweck-Maschinerie: er ruft
``OpenRouterService`` direkt statt über ``run_ai``, und der Dienst reichte nur
``temperature`` und ``max_tokens`` durch. ``reasoning`` wurde also nie
gesendet, obwohl es auf dem anderen Pfad längst existierte — und
``_sanitize_response`` entfernte stattdessen ``<think>``-Blöcke aus den
Antworten. Ein Symptom wurde weggeputzt, dessen Ursache abschaltbar war.
"""

from __future__ import annotations

from backend.services.ai_purposes import AI_PURPOSES
from backend.services.chat_ai_service import (
    _CHAT_FREQUENCY_PENALTY,
    _CHAT_TEMPERATURE,
    _CHAT_TOP_P,
    _CONTEXT_WINDOWS,
    _chat_max_tokens,
    _history_token_budget,
)
from backend.services.external.openrouter import OpenRouterService
from backend.services.platform_model_config import get_platform_model, get_platform_reasoning


class TestDerChatHatEinenEigenenZweck:
    def test_chat_response_ist_deklariert(self) -> None:
        """Vorher fiel er unter Regel 3 in ``model_default``.

        Der Chat folgte damit jeder Modellentscheidung, die für Schmiede oder
        Einordnung getroffen wurde.
        """
        assert "chat_response" in AI_PURPOSES
        assert AI_PURPOSES["chat_response"].model_key == "chat"

    def test_er_loest_auf_v4_flash_auf(self) -> None:
        assert get_platform_model("chat_response") == "deepseek/deepseek-v4-flash"

    def test_reasoning_ist_abgeschaltet_nicht_offen(self) -> None:
        """``off`` sendet ``{"enabled": False}`` — ``auto`` sendet gar nichts.

        Der Unterschied ist der Punkt: für Charakter-Rollenspiel trägt
        Nachdenken nichts zur Personentreue bei, kostet aber Token und leckt
        als ``<think>`` in die Antwort.
        """
        assert get_platform_reasoning("chat_response") == {"enabled": False}

    def test_das_budget_kommt_aus_der_deklaration(self) -> None:
        """Sonst stünde die Zahl an zwei Orten und die Deklaration wäre Zierrat."""
        assert _chat_max_tokens() == AI_PURPOSES["chat_response"].max_tokens == 1400


class TestDieFensterTabelleOrdnetRichtig:
    def test_v4_steht_vor_dem_allgemeinen_deepseek(self) -> None:
        """Die Suche nimmt den ERSTEN passenden Präfix.

        Stünde ``deepseek`` vorn, bekäme v4-flash die 128k des Vorgängers —
        ein Achtel seines Fensters.
        """
        keys = list(_CONTEXT_WINDOWS)
        assert keys.index("deepseek-v4") < keys.index("deepseek")

    def test_v4_flash_bekommt_das_grosse_fenster(self) -> None:
        gross = _history_token_budget("deepseek/deepseek-v4-flash")
        klein = _history_token_budget("deepseek/deepseek-chat")
        assert gross > klein * 5, f"v4 {gross} gegen chat {klein} — der Präfix greift nicht."


class TestDieReglerGehenWirklichRaus:
    def test_der_dienst_sendet_nur_gesetzte_regler(self) -> None:
        """``None`` heißt „das Modell entscheidet", ein Vorgabewert heißt
        „ich habe entschieden". Das ist nicht dasselbe."""
        leer = OpenRouterService._sampling(top_p=None, frequency_penalty=None, presence_penalty=None, reasoning=None)
        assert leer == {}

        voll = OpenRouterService._sampling(
            top_p=0.95, frequency_penalty=0.15, presence_penalty=None, reasoning={"enabled": False}
        )
        assert voll == {
            "top_p": 0.95,
            "frequency_penalty": 0.15,
            "reasoning": {"enabled": False},
        }
        assert "presence_penalty" not in voll, (
            "Ein Regler, der nichts tut, ist schlechter als keiner — presence_penalty bleibt absichtlich ungesetzt."
        )

    def test_alle_drei_anbieterwege_kennen_die_regler(self) -> None:
        """Ein Weg ohne die Regler wäre ein Weg mit anderem Verhalten."""
        import inspect

        for name in ("generate", "generate_with_system", "stream_completion"):
            sig = inspect.signature(getattr(OpenRouterService, name))
            for p in ("top_p", "frequency_penalty", "presence_penalty", "reasoning"):
                assert p in sig.parameters, f"{name} kennt {p} nicht"

    def test_die_werte_liegen_im_sinnvollen_bereich(self) -> None:
        # Über 1,5 kippt die Figur aus der Rolle; unter 1,0 wäre es kein
        # Zugewinn gegenüber der Vorgabe.
        assert 1.0 < _CHAT_TEMPERATURE <= 1.3
        assert 0.9 <= _CHAT_TOP_P <= 1.0
        # Über ~0,5 trifft die Häufigkeitsstrafe die Eigennamen.
        assert 0 < _CHAT_FREQUENCY_PENALTY <= 0.5
