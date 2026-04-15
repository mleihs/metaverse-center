"""Generate Instagram feed posts with REAL images from local Supabase + HTML gallery.

Downloads actual FLUX-generated agent portraits and building photos
(Cite des Dames simulation), composes them through the Bureau overlay
pipeline, and generates an HTML review page for visual QA.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/generate_real_instagram_gallery.py
    open _test_output/instagram_gallery/index.html
"""

from __future__ import annotations

import asyncio
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

OUTPUT = Path("_test_output/instagram_gallery")
BASE = "http://127.0.0.1:54321/storage/v1/object/public"
SIM = "50000000-0000-0000-0000-000000000001"  # Cite des Dames (production)
BANNER = f"{BASE}/simulation.assets/{SIM}/banner.webp"

AGENTS = [
    ("Ada Lovelace", f"{BASE}/agent.portraits/{SIM}/af16f3b0-a00d-490c-91ff-f19f125a7bc0/2da926f2-539d-47e6-a875-bda32e31275b.avif"),
    ("Christine de Pizan", f"{BASE}/agent.portraits/{SIM}/b0519084-f58b-4a2d-8139-226a768a2146/164a253b-35b2-452a-a3c6-6a6b981d2781.avif"),
    ("Hildegard von Bingen", f"{BASE}/agent.portraits/{SIM}/380aea48-84f9-40c9-889c-16d746259d26/1bdc0b68-6d2b-41f0-a6df-2afdfe52dc38.avif"),
    ("Mary Wollstonecraft", f"{BASE}/agent.portraits/{SIM}/5da68bc8-c5cb-41ad-8f1d-9e5d1e6ab1e8/3134461c-a6f7-47dd-81b6-c79a952a1c02.avif"),
    ("Sojourner Truth", f"{BASE}/agent.portraits/{SIM}/b2622fd9-1021-463e-afad-6cbbb444e94b/06223817-7b21-4e7f-a9d1-c8a81f4692bb.avif"),
    ("Sor Juana Ines de la Cruz", f"{BASE}/agent.portraits/{SIM}/cc93c810-99a4-419a-9d68-b312e6c512ec/edbe0197-2b46-4e90-a9bc-1a08e7588963.avif"),
]

BUILDINGS = [
    ("The College of Letters", f"{BASE}/building.images/{SIM}/471bf183-7a23-4641-9d1b-e07f811a050b/9f41847a-8f2f-43ff-aa78-23afe04b0640.avif"),
    ("The Footnote Room", f"{BASE}/building.images/{SIM}/0529fa92-43de-4589-83f3-e693af6ee6ce/17ac5457-d10b-4c55-8ad6-0d9fcdb5c377.avif"),
    ("The Garden of Remembered Names", f"{BASE}/building.images/{SIM}/23a06c32-e586-4946-afa3-31af31cd70a0/4e00a6d9-c2c6-454f-8d2a-de32b7f280a4.avif"),
    ("The Gate of Justice", f"{BASE}/building.images/{SIM}/e7c4170c-ce2e-4939-95b8-4edb868368e4/8f6ea9de-c13d-4b60-a14a-53570fa35097.avif"),
    ("The Hall of Declarations", f"{BASE}/building.images/{SIM}/b18b0805-2f9d-423c-9275-d6fead648961/3605f661-4c53-4307-ba58-c43d33a36459.avif"),
    ("The Listening Wall", f"{BASE}/building.images/{SIM}/c6ad04e1-83e2-48e1-8a38-afc9b188b618/7f9f7f45-1f25-4c17-b899-b4316e4195bf.avif"),
    ("The Observatory of the Blazing World", f"{BASE}/building.images/{SIM}/ce98b61d-783b-489c-9a34-4180cf64e97d/2625bda6-377b-461a-9277-5b350344fcc2.avif"),
    ("The Salon of Reason", f"{BASE}/building.images/{SIM}/f1f689e7-5fd6-4742-ae81-d305faeb9e60/559bcdfd-9bc7-42e0-94dd-a546a9d4e429.avif"),
    ("The Scriptorium", f"{BASE}/building.images/{SIM}/c471ae39-c984-462f-987b-c3acfa82f6f4/e3d171d9-b03a-4254-9cd9-625e99861b48.avif"),
    ("The Unnamed Archive", f"{BASE}/building.images/{SIM}/bc825013-a000-4042-8b19-3c2b85f58d37/3c61af28-bfc5-4ff7-8d4a-f326d5cfcdc7.avif"),
]

CLASSIFICATIONS = ["PUBLIC", "AMBER", "RESTRICTED"]
CIPHERS = [None, "BUREAU-7741-OMEGA", "DISPATCH-0042-KAPPA", None, "CLASSIFIED-ALPHA-9"]


async def main() -> None:
    import httpx

    from backend.services.instagram_image_service import InstagramImageService
    from unittest.mock import MagicMock

    OUTPUT.mkdir(parents=True, exist_ok=True)
    svc = InstagramImageService(supabase=MagicMock())
    results: list[tuple[str, bytes, str, str]] = []  # (filename, jpeg, title, category)

    async with httpx.AsyncClient(timeout=15) as client:
        n_total = len(AGENTS) + len(BUILDINGS) + 4 + 2  # agents + buildings + dispatches + stories
        # ── Agent Dossier Posts ──────────────────────────────────────
        for i, (name, url) in enumerate(AGENTS):
            print(f"[{i+1:02d}/{n_total}] Agent: {name}")
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"  SKIP (HTTP {resp.status_code})")
                continue
            classif = CLASSIFICATIONS[i % 3]
            cipher = CIPHERS[i % len(CIPHERS)]
            jpeg = svc._compose_with_overlay(
                image_bytes=resp.content,
                title=f"PERSONNEL FILE -- {name}",
                subtitle="SHARD: Cite des Dames",
                color_primary="#e2e8f0",
                color_background="#0f172a",
                classification=classif,
                cipher_hint=cipher,
            )
            slug = name.lower().replace(" ", "_")
            results.append((f"agent_{slug}.jpg", jpeg, f"Personnel File: {name}", "Agent Dossier"))

        n_agents = len(AGENTS)
        # ── Building Surveillance Posts ──────────────────────────────
        for i, (name, url) in enumerate(BUILDINGS):
            print(f"[{n_agents+i+1:02d}/{n_total}] Building: {name}")
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"  SKIP (HTTP {resp.status_code})")
                continue
            classif = CLASSIFICATIONS[(i + 1) % 3]
            jpeg = svc._compose_with_overlay(
                image_bytes=resp.content,
                title=f"SHARD SURVEILLANCE -- {name}",
                subtitle="LOCATION: Cite des Dames",
                color_primary="#e2e8f0",
                color_background="#0f172a",
                classification=classif,
            )
            slug = name.lower().replace(" ", "_").replace("-", "_")
            results.append((f"building_{slug}.jpg", jpeg, f"Surveillance: {name}", "Building Surveillance"))

        n_content = n_agents + len(BUILDINGS)
        # ── 4 Bureau Dispatch Posts (with banner as background) ──────
        resp = await client.get(BANNER)
        banner_bytes = resp.content if resp.status_code == 200 else None

        dispatches = [
            ("DISPATCH [0001] -- Substrate Alert", "RE: Cite des Dames -- Anomaly Detected", "AMBER"),
            ("DISPATCH [0002] -- Personnel Review", "RE: Cite des Dames -- Classification Update", "RESTRICTED"),
            ("DISPATCH [0003] -- Shard Monitoring", "RE: Cite des Dames -- Stability Report", "PUBLIC"),
            ("DISPATCH [0004] -- Archive Unsealed", "RE: Cite des Dames -- Declassified", "AMBER"),
        ]
        for i, (title, subtitle, classif) in enumerate(dispatches):
            print(f"[{n_content+i+1:02d}/{n_total}] Dispatch: {title}")
            if banner_bytes:
                jpeg = svc._compose_with_overlay(
                    image_bytes=banner_bytes,
                    title=title, subtitle=subtitle,
                    color_primary="#e2e8f0", color_background="#0f172a",
                    classification=classif,
                    cipher_hint="CIPHER-BUREAU-4419" if i == 0 else None,
                )
            else:
                # Fallback solid
                from backend.services.instagram_image_helpers import generate_solid_background
                jpeg = svc._compose_with_overlay(
                    image_bytes=generate_solid_background("#0f172a"),
                    title=title, subtitle=subtitle,
                    color_primary="#e2e8f0", color_background="#0f172a",
                    classification=classif,
                )
            results.append((f"dispatch_{i+1:02d}.jpg", jpeg, title, "Bureau Dispatch"))

        # ── 2 Impact Stories with real banner ────────────────────────
        n_pre_stories = n_content + 4
        if banner_bytes:
            print(f"[{n_pre_stories+1:02d}/{n_total}] Story: Impact with banner")
            jpeg = svc.compose_story_impact(
                simulation_name="Cite des Dames", effective_magnitude=0.78,
                events_spawned=["Cathedral Resonance Shift", "Market Panic", "Archive Breach"],
                narrative_closing="The substrate remembers what the surface tries to forget.",
                accent_hex="#e2e8f0", sim_color_hex="#64748b",
                banner_bytes=banner_bytes, portraits=None,
                reactions=[{"agent_name": "Christine de Pizan", "text": "The city remembers what its builders tried to erase.", "emotion": "quiet resolve"}],
            )
            results.append(("story_impact_banner.jpg", jpeg, "Shard Impact: Cite des Dames", "Story: Impact"))

            print(f"[{n_pre_stories+2:02d}/{n_total}] Story: Impact high magnitude")
            jpeg = svc.compose_story_impact(
                simulation_name="Cite des Dames", effective_magnitude=0.95,
                events_spawned=["Total Structural Collapse", "Mass Displacement", "Reality Breach", "Bureau Lockdown", "Emergency Dispatch"],
                narrative_closing="When certainty fractures, what spills through is not chaos but memory.",
                accent_hex="#e74c3c", sim_color_hex="#c0392b",
                banner_bytes=banner_bytes, portraits=None, reactions=None,
            )
            results.append(("story_impact_catastrophic.jpg", jpeg, "Shard Impact: Catastrophic", "Story: Impact"))

    # ── Save all ─────────────────────────────────────────────────────
    print(f"\nSaving {len(results)} images...")
    for fname, jpeg, _, _ in results:
        (OUTPUT / fname).write_bytes(jpeg)

    # ── Generate HTML gallery ────────────────────────────────────────
    cards = []
    for fname, jpeg, title, category in results:
        b64 = base64.b64encode(jpeg).decode()
        w, h = (1080, 1350) if "story" not in fname else (1080, 1920)
        aspect = "4/5" if "story" not in fname else "9/16"
        cards.append(f"""
        <div class="card" data-category="{category}">
            <div class="img-wrap" style="aspect-ratio: {aspect}">
                <img src="data:image/jpeg;base64,{b64}" alt="{title}" loading="lazy">
            </div>
            <div class="meta">
                <span class="cat">{category}</span>
                <span class="title">{title}</span>
                <span class="size">{len(jpeg)/1024:.0f} KB</span>
            </div>
        </div>""")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bureau of Impossible Geography -- Instagram Gallery Review</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: #0a0a0f; color: #e2e8f0; font-family: 'SF Mono', 'Fira Code', monospace; padding: 24px; }}
h1 {{ font-size: 20px; color: #f39c12; margin-bottom: 8px; letter-spacing: 2px; }}
.subtitle {{ color: #64748b; font-size: 13px; margin-bottom: 32px; }}
.filters {{ margin-bottom: 24px; display: flex; gap: 8px; flex-wrap: wrap; }}
.filters button {{ background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 6px 16px;
    font-family: inherit; font-size: 12px; cursor: pointer; transition: all 0.2s; }}
.filters button:hover, .filters button.active {{ background: #f39c12; color: #0a0a0f; border-color: #f39c12; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }}
.card {{ background: #111827; border: 1px solid #1e293b; overflow: hidden; transition: transform 0.2s; }}
.card:hover {{ transform: scale(1.02); border-color: #f39c12; }}
.card.hidden {{ display: none; }}
.img-wrap {{ width: 100%; overflow: hidden; }}
.img-wrap img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
.meta {{ padding: 12px; display: flex; flex-direction: column; gap: 4px; }}
.cat {{ font-size: 10px; color: #f39c12; letter-spacing: 1px; text-transform: uppercase; }}
.title {{ font-size: 13px; color: #cbd5e1; }}
.size {{ font-size: 11px; color: #475569; }}
.stats {{ color: #475569; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b; }}
</style>
</head>
<body>
<h1>BUREAU OF IMPOSSIBLE GEOGRAPHY</h1>
<p class="subtitle">Instagram Feed Post Gallery -- {len(results)} images for visual QA review</p>
<div class="filters">
    <button class="active" onclick="filter('all')">All ({len(results)})</button>
    <button onclick="filter('Agent Dossier')">Agents ({sum(1 for _,_,_,c in results if c=='Agent Dossier')})</button>
    <button onclick="filter('Building Surveillance')">Buildings ({sum(1 for _,_,_,c in results if c=='Building Surveillance')})</button>
    <button onclick="filter('Bureau Dispatch')">Dispatches ({sum(1 for _,_,_,c in results if c=='Bureau Dispatch')})</button>
    <button onclick="filter('Story: Impact')">Stories ({sum(1 for _,_,_,c in results if 'Story' in c)})</button>
</div>
<div class="grid">
{"".join(cards)}
</div>
<div class="stats">
    Total: {len(results)} images | {sum(len(j) for _,j,_,_ in results)/1024:.0f} KB |
    Generated from local Supabase ({SIM[:8]}...)
</div>
<script>
function filter(cat) {{
    document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.card').forEach(c => {{
        c.classList.toggle('hidden', cat !== 'all' && c.dataset.category !== cat);
    }});
}}
</script>
</body>
</html>"""

    (OUTPUT / "index.html").write_text(html)
    total_kb = sum(len(j) for _, j, _, _ in results) / 1024
    print(f"\n{'='*60}")
    print(f"  {len(results)} images saved to {OUTPUT}/")
    print(f"  Total: {total_kb:.0f} KB")
    print(f"  Gallery: {OUTPUT}/index.html")
    print(f"{'='*60}")
    print(f"\n  open {OUTPUT}/index.html")


if __name__ == "__main__":
    asyncio.run(main())
