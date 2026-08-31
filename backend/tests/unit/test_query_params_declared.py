"""Der Frontend-Typ `ApiQueryParam` und die Router müssen dasselbe sagen (D10-6).

BEFUND
------
Die API-Dienste nahmen `params?: Record<string, string>` entgegen. Dieser Typ
nimmt jeden Schlüssel an, und vier Aufrufstellen in den Chat-Komponenten
schickten `page_size` — einen Namen, den kein FastAPI-Endpunkt je deklariert
hat. FastAPI verwirft einen unbekannten Query-Parameter wortlos: kein 422,
keine Logzeile, kein Sentry-Ereignis. Gemessen, was das kostete:

    ChatWindow  wollte 100 Nachrichten  → bekam  50 (Vorgabe)
    EventPicker wollte 100 Ereignisse   → bekam  25 (Vorgabe)
    AgentSelector wollte 100 Agenten    → bekam  25 (Vorgabe)

Ein falscher Parametername ist zur Laufzeit nicht von einem zu unterscheiden,
der nie gesendet wurde. Sichtbar wird der Unterschied nur im Typsystem — also
wohnt er jetzt dort, und `tsc` (Teil von `lint:full`) ist die Prüfung.

WAS DER TYP SOFORT MITGEFUNDEN HAT
-----------------------------------
Beim ersten `tsc`-Lauf nach der Umstellung fielen zwei weitere Stellen an, die
niemand gesucht hatte:

* `LocationsView` schickte `order: 'created_at.desc'`. Der Endpunkt kennt
  kein `order`; der Dienst sortiert ohnehin nach `tick_number DESC,
  created_at DESC`. Der Parameter war doppelt tot — unbekannt UND überflüssig.
* Der Terminal-Befehl `scan` schickte `event_status: 'active'`. Die Spalte
  `events.event_status` existiert und trägt den Alterungszustand
  (active → escalating → resolving → resolved → archived), aber der Endpunkt
  bot den Filter nicht an. Der Befehl zeigte seit jeher auch abgeschlossene und
  archivierte Ereignisse. Hier war die Aufrufstelle im Recht und der Endpunkt
  unvollständig: `event_status` ist ergänzt worden, auf der Mitglieds- UND der
  öffentlichen Route (Public-First — sonst sähe ein Besucher andere Ereignisse
  als ein Mitglied).

DIE FALLE IM MESSGERÄT SELBST
-----------------------------
Der erste Generator las den ARGUMENTNAMEN der Router-Funktion. Neun
Deklarationen tragen aber `Query(alias=...)`, und dort zählt der Alias:
`status_filter: Annotated[str | None, Query(alias="status")]` heißt auf der
Leitung `status`. Die erste Union enthielt deshalb `status_filter` (auf der
Leitung nie gültig) und es fehlte `proposal_status` (in `epochs.py` heißt das
Argument `status` und der Alias `proposal_status` — genau andersherum). Wieder
J3c: gemessen wurde sauber, nur das falsche Feld.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
ROUTERS = BACKEND / "routers"
UNION_FILE = REPO / "frontend/src/services/api/query-params.ts"


def declared_query_params() -> dict[str, list[str]]:
    """Every query-parameter name a router declares, by wire name.

    The wire name is ``Query(alias=...)`` when present, otherwise the argument
    name. Getting that backwards is the mistake this docstring describes.
    """
    found: dict[str, list[str]] = {}
    for path in sorted(ROUTERS.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncFunctionDef | ast.FunctionDef):
                continue
            for arg in list(node.args.args) + list(node.args.kwonlyargs):
                if arg.annotation is None:
                    continue
                if "Query(" not in ast.unparse(arg.annotation):
                    continue
                wire = arg.arg
                for inner in ast.walk(arg.annotation):
                    if not isinstance(inner, ast.Call):
                        continue
                    callee = getattr(inner.func, "id", None) or getattr(inner.func, "attr", None)
                    if callee != "Query":
                        continue
                    for keyword in inner.keywords:
                        if keyword.arg == "alias" and isinstance(keyword.value, ast.Constant):
                            wire = str(keyword.value.value)
                found.setdefault(wire, []).append(f"{path.name}:{arg.lineno}")
    return found


def union_members() -> set[str]:
    """The names listed in the TS `ApiQueryParam` union.

    Read from the union body only, not the whole file — the header comment
    names `page_size`, `order` and `status_filter` on purpose in order to
    explain the defect, and a file-wide scan would happily collect them (J3b).
    """
    source = UNION_FILE.read_text(encoding="utf-8")
    start = source.index("export type ApiQueryParam =")
    body = source[start : source.index(";", start)]
    return set(re.findall(r"'([a-z0-9_]+)'", body))


class TestTheGateItself:
    def test_both_sides_are_readable(self) -> None:
        declared = declared_query_params()
        union = union_members()
        assert len(declared) > 50, f"nur {len(declared)} Query-Parameter gefunden — der AST-Lauf ist kaputt"
        assert len(union) > 50, f"nur {len(union)} Union-Einträge gelesen — der Regex ist kaputt"

    def test_the_alias_case_is_actually_handled(self) -> None:
        """Nine declarations carry an alias; getting them wrong is silent."""
        declared = declared_query_params()
        assert "status" in declared, "der Alias status wurde nicht aufgelöst"
        assert "status_filter" not in declared, (
            "status_filter ist ein ARGUMENTname, kein Draht-Name — der Alias wird nicht gelesen"
        )
        assert "proposal_status" in declared, (
            "epochs.py deklariert das Argument 'status' mit Alias 'proposal_status' — "
            "genau der umgekehrte Fall, und er fehlt"
        )

    def test_the_union_body_excludes_the_explaining_comment(self) -> None:
        """The header names the removed parameters; they must not leak in."""
        union = union_members()
        for explained in ("page_size", "status_filter"):
            assert explained not in union, (
                f"'{explained}' steht in der Union — entweder ist es zurückgekehrt, "
                "oder der Auszug liest den Kopfkommentar mit"
            )


class TestTheTwoSidesAgree:
    def test_every_union_member_is_declared_by_a_router(self) -> None:
        declared = declared_query_params()
        stale = sorted(union_members() - set(declared))
        assert not stale, (
            "Diese Namen stehen im Frontend-Typ, aber kein Router deklariert sie. "
            "Ein Aufrufer könnte sie senden und FastAPI verwürfe sie wortlos:\n  "
            + "\n  ".join(stale)
        )

    def test_every_declared_param_is_in_the_union(self) -> None:
        declared = declared_query_params()
        missing = sorted(set(declared) - union_members())
        assert not missing, (
            "Diese Query-Parameter sind im Backend deklariert und fehlen im "
            "Frontend-Typ — kein Aufrufer kann sie senden, ohne dass tsc rot wird:\n  "
            + "\n  ".join(f"{name}  ({', '.join(declared[name])})" for name in missing)
        )


class TestTheParticularNamesThatCausedThis:
    def test_page_size_is_declared_nowhere(self) -> None:
        """The premise of the whole fix."""
        assert "page_size" not in declared_query_params()

    def test_event_status_is_now_offered_on_both_routes(self) -> None:
        """The terminal's `scan` sent it for years; the endpoint now accepts it.

        Asserted on both files because Public-First means a visitor and a member
        must be able to ask the same question.
        """
        declared = declared_query_params()
        assert "event_status" in declared
        files = {site.split(":")[0] for site in declared["event_status"]}
        assert {"events.py", "public.py"} <= files, (
            f"event_status fehlt auf einer der beiden Routen: {sorted(files)}"
        )

    def test_the_api_services_no_longer_accept_an_open_record(self) -> None:
        """`Record<string, string>` was the hole; it must stay closed."""
        offenders = []
        for path in sorted((REPO / "frontend/src/services/api").glob("*.ts")):
            text = path.read_text(encoding="utf-8")
            # The generated file names the old type in its header on purpose.
            if path.name == "query-params.ts":
                continue
            if "params?: Record<string, string>" in text:
                offenders.append(path.name)
        assert not offenders, (
            "Diese API-Dienste nehmen wieder beliebige Parameternamen an: " + ", ".join(offenders)
        )
