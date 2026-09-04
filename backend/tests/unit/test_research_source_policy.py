"""Die Gattungsgrenze der Schmiede-Recherche, festgenagelt.

Die Recherche belegt Weltenbau mit drei Gattungen — literarischen Werken und
Literaturkritik, philosophischen Schriften, begutachteter Fachliteratur. Diese
Tests pinnen die Stelle, an der das entschieden wird, und die vier Arten, auf
die eine solche Entscheidung erfahrungsgemaess still danebengeht:

* Der Hostvergleich ist zu weich, und ein Angreifer nimmt einen erlaubten Namen
  in den eigenen auf (``nicht-jstor.org.beispiel.test``).
* Die Freiliste schlaegt die Sperrliste, statt umgekehrt.
* Ein "vertrauenswuerdiger" Anbieter umgeht die Sperrliste ganz.
* Der Filter saeubert die Anzeige, aber nicht den Text, den das Modell liest.

Der letzte Punkt ist der, der den Anlass gab: eine Quellzeile und die Prosa
dazu entstanden auf zwei getrennten Wegen aus demselben Treffer.
"""

import pytest

from backend.services.platform_research_domains import HARDCODED_DEFAULTS, get_source_allowlist, get_source_denylist
from backend.services.research_source_policy import (
    SourceRow,
    filter_sources,
    is_admissible,
    is_listing,
    normalize_host,
)

# Die drei Gattungen, die den Anlass gaben. Ein Produktionslauf lieferte unter
# einer Achse MIT Domainliste ein Video, ein Fanwiki und einen Beitrag aus
# einem sozialen Netz — die Liste war eine Gewichtung, keine Schranke.
INCIDENT_HOSTS = (
    "https://www.youtube.com/watch?v=abc123",
    "https://silent-planet.fandom.com/wiki/Floating_Islands",
    "https://www.facebook.com/some-page/posts/123",
)

ADMISSIBLE_EXAMPLES = (
    "https://plato.stanford.edu/entries/memory/",
    "https://www.jstor.org/stable/27763542",
    "https://openlibrary.org/works/OL19668682W",
    "https://doi.org/10.1177/1750698007083889",
    "https://www.cambridge.org/core/journals/episteme/article/collective-amnesia",
)


class TestNormalizeHost:
    def test_strips_www_and_lowercases(self):
        assert normalize_host("HTTPS://WWW.JSTOR.ORG/stable/1") == "jstor.org"

    def test_strips_the_root_dot(self):
        # ``example.com.`` und ``example.com`` sind derselbe Host. Ohne das
        # ``rstrip`` waere der erste in keiner Liste und damit unzulaessig —
        # oder, bei einer Sperrliste, unsperrbar.
        assert normalize_host("https://jstor.org./stable/1") == "jstor.org"

    @pytest.mark.parametrize(
        "url",
        ["data:text/html,<p>", "javascript:alert(1)", "ftp://example.com/f", "not a url", ""],
    )
    def test_no_host_no_source(self, url: str):
        assert normalize_host(url) == ""
        assert is_admissible(url) is False
        # Auch nicht ueber die Hintertuer: kein Host bleibt kein Beleg.
        assert is_admissible(url, trusted_provider=True) is False


class TestGenrePolicy:
    @pytest.mark.parametrize("url", INCIDENT_HOSTS)
    def test_the_three_that_started_this_are_refused(self, url: str):
        assert is_admissible(url) is False

    @pytest.mark.parametrize("url", ADMISSIBLE_EXAMPLES)
    def test_scholarship_passes(self, url: str):
        assert is_admissible(url) is True

    def test_subdomain_of_an_allowed_domain_passes(self):
        assert is_admissible("https://ancient.jstor.org/x") is True

    def test_an_allowed_name_inside_a_foreign_one_does_not(self):
        # Der Grund fuer ``h == d or h.endswith("." + d)`` statt ``d in h``.
        assert is_admissible("https://nicht-jstor.org.beispiel.test/x") is False
        assert is_admissible("https://jstor.org.beispiel.test/x") is False

    def test_denylist_beats_allowlist(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            "backend.services.platform_research_domains.get_source_allowlist",
            lambda: ["youtube.com", "jstor.org"],
        )
        assert is_admissible("https://youtube.com/watch?v=1") is False
        assert is_admissible("https://jstor.org/stable/1") is True

    def test_a_trusted_provider_still_cannot_import_a_denied_host(self):
        # OpenAlex und Crossref melden Verlagshosts, die keine Freiliste je
        # vollstaendig kennt — darum duerfen sie an ihr vorbei. An der
        # Sperrliste nicht: ein DOI, der auf ein Fanwiki zeigt, bleibt keiner.
        assert is_admissible("https://link.springer.com/article/10.1007/x", trusted_provider=True) is True
        assert is_admissible("https://irgendwas.example.test/paper", trusted_provider=True) is True
        assert is_admissible("https://silent-planet.fandom.com/wiki/X", trusted_provider=True) is False


class TestFilterSources:
    def test_splits_and_counts_both_sides(self):
        rows = [
            SourceRow(axis="A", title="Video", url=INCIDENT_HOSTS[0]),
            SourceRow(axis="A", title="SEP", url=ADMISSIBLE_EXAMPLES[0]),
            SourceRow(axis="B", title="Wiki", url=INCIDENT_HOSTS[1]),
        ]
        outcome = filter_sources(rows)
        assert [r.title for r in outcome.kept] == ["SEP"]
        assert len(outcome.rejected) == 2
        # Die abgewiesenen Hosts stehen zur Verfuegung: eine Sperrliste findet
        # nur, was man ihr gesagt hat, und das hier ist der naechste Eintrag.
        assert "youtube.com" in outcome.rejected_hosts

    def test_deduplicates_by_url_first_axis_wins(self):
        rows = [
            SourceRow(axis="FIRST", title="x", url=ADMISSIBLE_EXAMPLES[1]),
            SourceRow(axis="SECOND", title="x", url=ADMISSIBLE_EXAMPLES[1]),
        ]
        outcome = filter_sources(rows)
        assert len(outcome.kept) == 1
        assert outcome.kept[0].axis == "FIRST"

    def test_trusted_providers_are_named_not_assumed(self):
        row = SourceRow(axis="A", title="paper", url="https://irgendwas.example.test/p", provider="openalex")
        assert filter_sources([row]).kept == []
        assert filter_sources([row], trusted_providers=frozenset({"openalex"})).kept == [row]

    def test_an_empty_url_is_dropped_without_counting_as_rejected(self):
        # Eine Zeile ohne URL ist kein abgewiesener Beleg, sondern gar keiner.
        # Sie in ``rejected`` zu zaehlen wuerde die Zahl unbrauchbar machen,
        # die sagt, wie viel die Gattungsgrenze tatsaechlich aussortiert.
        outcome = filter_sources([SourceRow(axis="A", title="leer", url="  ")])
        assert outcome.kept == [] and outcome.rejected == []


class TestDefaultLists:
    def test_no_domain_is_both_allowed_and_denied(self):
        # Sonst haette die Reihenfolge der Pruefung eine stille Bedeutung.
        assert set(get_source_allowlist()) & set(get_source_denylist()) == set()

    def test_the_steering_lists_stay_inside_the_genre(self):
        # Eine Steuerliste, die auf etwas zeigt, das die Schranke ohnehin
        # abweist, verschenkt Treffer: Tavily sucht dort und liefert nichts,
        # was durchkommt. Bis 2026-09-04 galt das fuer ``dezeen.com`` und
        # ``designboom.com`` auf der Architekturachse.
        allowed = set(get_source_allowlist())
        for key, domains in HARDCODED_DEFAULTS.items():
            if not key.startswith("research_domains_"):
                continue
            assert set(domains) <= allowed, f"{key} zeigt auf nicht zugelassene Domains"

    def test_the_lists_are_reachable_without_a_database(self):
        # ``get_source_*`` faellt auf die Vorgabewerte zurueck, wenn der
        # Zwischenspeicher leer ist — sonst waere die Schranke waehrend des
        # Hochlaufs offen, also genau dann, wenn niemand hinsieht.
        assert "jstor.org" in get_source_allowlist()
        assert "youtube.com" in get_source_denylist()


class TestListingsAreNotSources:
    """Eine Trefferliste hat keinen Autor, kein Jahr und morgen andere Eintraege.

    Gemessen am 2026-09-04 kam ``philarchive.org/s/epistemology%20of%20memory``
    als Beleg durch: die Suchmaschine hatte die Suchseite einer anderen
    Suchmaschine gefunden. Der Host ist zugelassen, der Inhalt ist kein Werk.
    """

    @pytest.mark.parametrize(
        "url",
        [
            "https://philarchive.org/s/epistemology%20of%20memory",
            "https://philpapers.org/search?q=memory",
            "https://www.jstor.org/action/doBasicSearch?Query=memory",
            "https://openlibrary.org/search?q=memory",
            "https://archive.org/browse/texts",
        ],
    )
    def test_a_listing_is_refused(self, url: str):
        assert is_listing(url) is True
        assert is_admissible(url) is False
        # Auch von einem Fachanbieter gemeldet bleibt es eine Liste.
        assert is_admissible(url, trusted_provider=True) is False

    @pytest.mark.parametrize(
        "url",
        [
            # Der Pfad wird am ANFANG geprueft, nicht auf Vorkommen: sonst
            # verlöre man jeden Artikel, der zufaellig "search" im Titel hat.
            "https://plato.stanford.edu/entries/search-engines-and-ethics",
            "https://philarchive.org/rec/FRIF-5",
            "https://www.jstor.org/stable/27763542",
            "https://doi.org/10.1111/0018-2656.00198",
        ],
    )
    def test_a_work_is_not_a_listing(self, url: str):
        assert is_listing(url) is False
        assert is_admissible(url) is True


class TestOneWorkOneRow:
    def test_the_same_work_from_two_providers_appears_once(self):
        # Gemessen: Frise, "Forgetting" stand zweimal in der Liste - einmal von
        # PhilPapers, einmal von PhilArchive, unter verschiedenen URLs. Der
        # Filter nach URL sieht das nicht.
        rows = [
            SourceRow(axis="A", title="Forgetting", url="https://philpapers.org/rec/FRIF-5", year="2018"),
            SourceRow(axis="A", title="  forgetting ", url="https://philarchive.org/rec/FRIF-5", year="2018"),
        ]
        outcome = filter_sources(rows)
        assert len(outcome.kept) == 1
        assert outcome.kept[0].url == "https://philpapers.org/rec/FRIF-5"
        # Die zweite Zeile ist NICHT abgewiesen - sie war zulaessig, nur schon da.
        assert outcome.rejected == []

    def test_two_works_may_share_a_title(self):
        rows = [
            SourceRow(axis="A", title="Memory", url="https://philpapers.org/rec/A", year="1998"),
            SourceRow(axis="A", title="Memory", url="https://philpapers.org/rec/B", year="2016"),
        ]
        assert len(filter_sources(rows).kept) == 2

    def test_without_a_year_nothing_is_merged(self):
        # Raten ist hier teurer als doppelt anzeigen: zwei gleichnamige Werke
        # ohne Jahr zusammenzulegen loescht eine echte Quelle.
        rows = [
            SourceRow(axis="A", title="Memory", url="https://philpapers.org/rec/A"),
            SourceRow(axis="A", title="Memory", url="https://philpapers.org/rec/B"),
        ]
        assert len(filter_sources(rows).kept) == 2
