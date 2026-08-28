"""Chroma-key + despill for generated dungeon enemy art.

The enemy images are authored on a flat magenta field (#FF00FF) so the creature
can be lifted onto the dungeon scene, which paints ``--color-surface`` (#0a0a0a).

Why a hand-rolled key instead of a library: the subjects are deliberately
smoke-edged (The Shadow's wisps, motion-ghosted limbs). A hard threshold eats
those edges; a naive alpha leaves a magenta halo. So alpha is driven by a
*magenta-excess* term -- how far green sits below the mean of red and blue --
which degrades smoothly across a translucent edge instead of snapping.

Measured on the first four Shadow assets: 1.4-4.4% of the frame lands in the
soft band (the part that decides whether the cutout reads), and residual magenta
inside visible pixels comes out at 0.030-0.080 on a 0-1 scale. Against the
near-black scene that residue reads as a cool shadow tone rather than a fringe.

Usage:
    python scripts/key_dungeon_enemy_art.py IN_DIR OUT_DIR [--check]

Input files are named after the enemy id (``shadow_wisp.png``); the id is carried
straight through to the output so the YAML patch step can match on it.

This is the FIRST half of the asset chain. The second half -- EnemyTemplate.
image_url, the migration, the DTO hops -- is rollout Phase 3a and lands
separately. Nothing here writes to the database: per A1.5 the content pack is the
single source of truth and its seed migration is TRUNCATE + re-insert, so an
image URL must travel YAML -> validate_content_packs -> generate_migration.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

#: Below this magenta-excess a pixel is fully opaque subject.
MAG_FLOOR = 0.12
#: Width of the ramp from opaque to fully keyed.
MAG_RAMP = 0.34
#: How much of the magenta excess survives despill (0 = clamp hard to green).
DESPILL_KEEP = 0.25
#: Alpha below this is treated as background when finding the crop box.
CROP_ALPHA = 12
#: Longest edge of the emitted asset.
MAX_EDGE = 1024
#: AVIF quality, matching scripts/generate_dungeon_detail_images.py.
AVIF_QUALITY = 80


def key_and_despill(path: Path) -> tuple[Image.Image, dict]:
    """Lift the subject off the magenta field. Returns (RGBA image, stats)."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    magenta_excess = np.clip(((r + b) * 0.5 - g) / 255.0, 0.0, 1.0)
    alpha = np.clip(1.0 - (magenta_excess - MAG_FLOOR) / MAG_RAMP, 0.0, 1.0)

    # Despill: pull red and blue down toward green wherever magenta dominates,
    # so the surviving translucent edge is neutral instead of pink.
    out = rgb.copy()
    cap = g + np.maximum(0.0, (r + b) * 0.5 - g) * DESPILL_KEEP
    spilled = (r > g) & (b > g)
    out[..., 0] = np.where(spilled, np.minimum(r, cap), r)
    out[..., 2] = np.where(spilled, np.minimum(b, cap), b)

    visible = alpha > 0.05
    soft = (alpha > 0.05) & (alpha <= 0.95)
    stats = {
        "soft_pct_of_frame": float(soft.mean() * 100),
        "soft_pct_of_subject": float(soft.sum() / max(visible.sum(), 1) * 100),
        "residual_magenta": float(magenta_excess[visible].mean()) if visible.any() else 0.0,
    }
    return Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), "RGBA"), stats


def process(src: Path, dst_dir: Path, *, check: bool) -> dict:
    im, stats = key_and_despill(src)

    box = im.getchannel("A").point(lambda v: 255 if v > CROP_ALPHA else 0).getbbox()
    if box is None:
        raise ValueError(f"{src.name}: nothing survived the key — is the background magenta?")
    im = im.crop(box)
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

    dst_dir.mkdir(parents=True, exist_ok=True)
    if check:
        # Contact sheet on the real scene ground, for eyeballing before commit.
        proof = Image.new("RGB", im.size, (10, 10, 10))
        proof.paste(im, (0, 0), im)
        proof.save(dst_dir / f"{src.stem}_on_scene.png")
    else:
        im.save(dst_dir / f"{src.stem}.avif", format="AVIF", quality=AVIF_QUALITY)

    stats["size"] = f"{im.size[0]}x{im.size[1]}"
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("in_dir", type=Path)
    ap.add_argument("out_dir", type=Path)
    ap.add_argument(
        "--check",
        action="store_true",
        help="emit PNG proofs composited on the scene ground instead of AVIF assets",
    )
    args = ap.parse_args()

    sources = sorted(
        p for p in args.in_dir.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not sources:
        print(f"No images in {args.in_dir}", file=sys.stderr)
        return 1

    worst = 0.0
    for src in sources:
        try:
            s = process(src, args.out_dir, check=args.check)
        except ValueError as exc:
            print(f"  FAIL  {exc}", file=sys.stderr)
            worst = 1.0
            continue
        flag = "  <-- pruefen" if s["residual_magenta"] > 0.12 else ""
        worst = max(worst, s["residual_magenta"])
        print(
            f"  {src.stem:28} {s['size']:>10}  "
            f"weich {s['soft_pct_of_subject']:4.1f}%  "
            f"Rest-Magenta {s['residual_magenta']:.3f}{flag}"
        )

    print(f"\n{len(sources)} Datei(en), hoechstes Rest-Magenta {worst:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
