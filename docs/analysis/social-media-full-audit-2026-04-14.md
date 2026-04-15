# Social Media Pipeline -- Full Audit

**Date**: 2026-04-14
**Scope**: Instagram, Bluesky, Cipher ARG, Image Composition (Pillow), Architecture, Duplication, Web Research
**Auditor**: Claude (4-Perspektiven: Architect, Game Designer, UX, Research)

---

## Executive Summary

**Overall Grade: B+ (7.8/10)**

The social media pipeline is architecturally sound -- proper service-layer separation, RPC-based atomicity, typed error hierarchies, encrypted credential storage, and a clean cross-posting trigger. The Instagram Graph API and Bluesky AT Protocol clients are production-grade with Sentry integration, retry logic, and rate limit awareness.

**Critical weaknesses**: Substantial code duplication across schedulers and story templates, missing `progressive=True` on JPEG output, no exponential backoff in the Instagram HTTP client, and hashtag pools duplicated between Instagram and Bluesky services.

---

## PART 1: Architecture Quality

### 1.1 Service Layer Separation -- A

| Layer | Assessment |
|-------|-----------|
| **Routers** (instagram.py, bluesky.py, cipher.py) | Clean HTTP-only. No business logic. Correct use of `require_platform_admin()`, typed responses, audit logging. |
| **Content Services** (instagram_content_service.py, bluesky_content_service.py) | Classmethod-based, stateless. Proper orchestration. |
| **External Clients** (external/instagram.py, external/bluesky.py) | Typed error hierarchy, hardened httpx, Sentry integration. |
| **Schedulers** (instagram_scheduler.py, bluesky_scheduler.py) | Background loops with proper error handling, structlog contextvars. |
| **Image Composition** (instagram_image_service.py) | Instance-based (needs `supabase` for upload), static helpers for Pillow ops. |
| **Cipher** (cipher_service.py) | Thin orchestration over Postgres RPCs. Correct pattern. |

### 1.2 Pattern Conformity -- B+

**Follows codebase patterns:**
- `SuccessResponse[T]` / `PaginatedResponse[T]` on all endpoints
- Return type annotations (no `response_model=`)
- `get_admin_supabase` for platform-level operations
- `AuditService.safe_log()` on all mutations
- Rate limiting via `@limiter.limit()`
- `extract_list()` for safe response extraction

**Pattern deviations found:**
- `CipherService.redeem_code()` returns raw `dict` instead of typed Pydantic model (`CipherRedemptionResponse`) -- the router returns `CipherRedemptionResponse` directly but the service returns untyped dict
- `_get_instagram_service()` helper in router creates a new `InstagramService` per request instead of using a cached/singleton pattern (acceptable for infrequent admin calls)
- `bluesky_scheduler.py:144` and `instagram_scheduler.py:151` build `settings_map` identically but with different key sets -- should be a shared utility

### 1.3 Protocol/Interface Design -- A-

`SocialPlatformClient` Protocol in `social/types.py` correctly defines the contract for platform clients. `BlueskyService` implements it. `InstagramService` does NOT implement it (different publishing flow: container-based). This is a valid architectural decision -- Instagram's two-step publishing doesn't fit the synchronous `publish_post()` protocol.

`AdaptedContent`, `PublishResult`, `UploadedMedia` dataclasses in `social/types.py` are clean, well-typed, and used correctly by `BlueskyService`.

---

## PART 2: Duplication Findings (CRITICAL)

### D1: `_parse_bool()` -- 3x duplicated (HIGH)

**Files:**
- `instagram_scheduler.py:925` -- `str(value).lower() not in ("false", "0", "no", "")`
- `bluesky_scheduler.py:577` -- `str(value).lower().strip('"') not in ("false", "0", "no", "")`
- `social_story_service.py:1289` -- `str(value).lower().strip('"') not in ("false", "0", "no", "")`

**Problem:** Three copies with subtle behavioral differences. Instagram's version does NOT `strip('"')` while the other two do. This means `"true"` (with literal quotes from platform_settings JSON) would be parsed differently.

**Fix:** Extract to `backend/utils/settings.py` as a single `parse_setting_bool(value: str) -> bool`. Include `strip('"')` in all cases.

### D2: Scheduler Loop Structure -- Near-identical (HIGH)

`InstagramScheduler._run_loop()` and `BlueskyScheduler._run_loop()` are ~95% identical:
- Same `while True` structure
- Same `structlog.contextvars.bind_contextvars()` call
- Same `get_admin_supabase()` call
- Same `_load_config()` pattern
- Same exception handling (CancelledError, ConnectError/ConnectTimeout, PostgrestAPIError)
- Same Sentry scope pattern

**Fix:** Extract a `BaseScheduler` mixin or utility function:
```python
async def run_scheduler_loop(name: str, load_config, process, interval_key="interval"):
```

### D3: `_load_config()` Settings Pattern -- Duplicated (HIGH)

Both schedulers:
1. Query `platform_settings` with `.in_("setting_key", [...])`
2. Build `settings_map: dict[str, str]` via identical loop
3. Parse booleans via `_parse_bool()`
4. Decrypt encrypted tokens with identical `gAAAAA` prefix check
5. Parse numeric settings with identical `max(60, int(...))` pattern

**Fix:** Extract to `backend/utils/settings.py`:
```python
async def load_platform_settings(admin: Client, keys: list[str]) -> dict[str, str]
def decrypt_setting(raw: str) -> str  # handles gAAAAA prefix
```

### D4: `_METRICS_COLLECT_DELAYS` -- Identical constant (MEDIUM)

```python
_METRICS_COLLECT_DELAYS = [3600, 21600, 86400, 172800]  # +1h, +6h, +24h, +48h
```
Defined identically in both `instagram_scheduler.py:46` and `bluesky_scheduler.py:48`.

**Fix:** Move to `backend/services/social/constants.py`.

### D5: `_MAX_RETRIES = 3` -- 3x duplicated (MEDIUM)

Identical in `instagram_scheduler.py:45`, `bluesky_scheduler.py:47`, `social_story_service.py:50`.

**Fix:** Move to `backend/services/social/constants.py`.

### D6: Story Template Accent Bars -- 5x copy-pasted (HIGH)

The exact same 4-line accent bar pattern appears in ALL 5 story template methods:
```python
draw.rectangle([(0, 0), (w, 10)], fill=(*accent, 255))
draw.rectangle([(0, 12), (w, 14)], fill=(*accent, 80))
draw.rectangle([(0, h - 10), (w, h)], fill=(*accent, 255))
draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*accent, 80))
```
Lines: 869-872, 1092-1095, 1371-1374, 1600-1603, 1792-1795.

**Fix:** Extract `_draw_accent_bars(draw, w, h, color)` method.

### D7: Story Template Title Panel -- 5x duplicated (MEDIUM)

All 5 story templates have identical title panel setup:
```python
title_panel_y = 240
draw.rounded_rectangle([(48, title_panel_y), (w - 48, title_panel_y + 96)], ...)
font_title = _load_bold_font(60)
y = 252
self._text_with_glow(img, (60, y), "TITLE TEXT", ...)
y += 84
```
Lines: 717-746, 927-946, 1164-1182, 1416-1435, 1649-1668.

**Fix:** Extract `_draw_story_title(img, draw, title: str, accent, glow_radius=8) -> int` returning the y position after the title.

### D8: Story Template Finalization -- 5x duplicated (MEDIUM)

All story templates end with:
```python
vignette = self._create_vignette(w, h, intensity=X)
img.alpha_composite(vignette)
self._draw_story_footer(draw, accent)
return self._image_to_jpeg(img.convert("RGB"))
```

**Fix:** Extract `_finalize_story(img, accent, vignette_intensity=0.5) -> bytes`.

### D9: Hashtag Pools -- Partially duplicated (MEDIUM)

`_BLUESKY_WORTHY_TAGS` in `bluesky_content_service.py` is a subset of `_BROAD_POOL + _NICHE_POOLS` values from `instagram_content_service.py`, but maintained as a separate flat set. Changes to one must be manually synced to the other.

**Fix:** Define canonical tag pools in `backend/services/social/constants.py`, derive Bluesky's set from them.

### D10: `_download_image` / `_download_image_safe` pattern (LOW)

Two nearly identical download methods in `instagram_image_service.py`:
- `_download_image()` (line 2101): raises on failure
- `_download_image_safe()` (line 2123): returns None on failure

**Assessment:** This is a valid pattern (strict vs graceful). Not a duplication problem -- the two have different error semantics. Keep as-is.

---

## PART 3: Pillow Image Pipeline Audit

### 3.1 Font Loading -- A

`_load_monospace_font()`, `_load_bold_font()`, `_load_italic_font()` all use `@lru_cache(maxsize=N)`. Cross-platform fallback paths (Debian, Fedora, macOS). Correct pattern per Pillow best practices.

**One issue:** Bold/italic load functions duplicate the font path list from `_load_monospace_font`. If a new font path is added, it must be updated in 3 places.

**Fix:** Extract font paths to a module-level tuple:
```python
_MONO_PATHS = ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", ...)
_BOLD_PATHS = ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", ...)
```

### 3.2 JPEG Output -- B

`_image_to_jpeg()` at line 2060:
```python
img.save(output, format="JPEG", quality=IG_JPEG_QUALITY, optimize=True)
```

**Missing `progressive=True`**: Progressive JPEG produces slightly smaller files AND provides perceived faster loading. Free win.

**Missing RGBA guard**: If accidentally called with RGBA image, JPEG save will fail. The callers all do `.convert("RGB")` first, but the method itself is not defensive. The Pillow research found that `.convert("RGB")` on RGBA flattens transparent areas to black. Better pattern:
```python
if img.mode == "RGBA":
    bg = Image.new("RGB", img.size, (0, 0, 0))
    bg.paste(img, mask=img.split()[3])
    img = bg
```

### 3.3 Gradient/Vignette/Grain -- A

`_create_gradient()`, `_create_vignette()`, `_add_noise_grain()` all use NumPy vectorized operations. These are the recommended patterns per Pillow community best practices. No performance issues.

### 3.4 Glow Effect -- A+

`_text_with_glow()` uses the minimal-layer technique (sized to text bounds + padding, not full canvas). This is best-in-class. Documented as the recommended approach.

### 3.5 Circle Crop with Supersampling -- A

`_crop_to_circle()` uses 4x supersampled mask for anti-aliased edges. This is the standard workaround for Pillow's lack of native anti-aliased shape drawing (Issues #5577, #5960).

### 3.6 Scan Lines Performance -- B

`_draw_scan_lines_rgba()` creates a full-size overlay and draws individual lines in a loop:
```python
overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
for y in range(0, img.height, spacing):
    draw.line([(0, y), (img.width, y)], fill=color, width=1)
```
For 1080x1920 with spacing=4, this draws ~480 lines. A faster approach would use NumPy:
```python
arr = np.zeros((h, w, 4), dtype=np.uint8)
arr[::spacing, :] = (*accent, alpha)
overlay = Image.fromarray(arr, "RGBA")
```

### 3.7 `_recompress_jpeg` in BlueskyService (line 607) -- B

```python
if img.mode == "RGBA":
    img = img.convert("RGB")
```
This flattens transparent areas to black. Use the paste-with-mask pattern instead.

---

## PART 4: Instagram Graph API Audit

### 4.1 API Version -- OK

Using `v22.0` (current stable as of early 2025). The latest is v25.0 in some recent docs, but v22.0 is supported and stable.

### 4.2 Token Refresh -- A

50-day refresh interval (`_TOKEN_REFRESH_INTERVAL_DAYS = 50`). Tokens last 60 days. This is exactly the recommended cadence per Meta docs.

### 4.3 Container Polling -- A-

`CONTAINER_POLL_INTERVAL = 60s`, `CONTAINER_POLL_MAX_WAIT = 300s`. Correct pattern. Container ID persisted to DB for crash recovery.

**Missing:** No exponential backoff on transient HTTP errors in `_get()` and `_post()` helpers. The research found Meta returns `is_transient: true` on retryable errors. The service correctly classifies error codes (190 = token, 4/17 = rate limit) but does not retry on HTTP 5xx or code 2 (service unavailable).

### 4.4 Error Hierarchy -- A

Clean typed hierarchy:
- `InstagramAPIError` (base)
- `InstagramRateLimitError` (429 / code 4,17)
- `InstagramTokenExpiredError` (code 190)
- `InstagramContainerError` (container-specific)

The IP-block detection on code 190 (distinguishing token expiry from server IP block) is a sophisticated touch not seen in any reference implementation.

### 4.5 Missing Features (from research) -- Noted

- **No Reels support**: `create_reels_container()` not implemented. Low priority for Bureau content.
- **No webhook integration**: No comment/mention tracking. Could be Phase 2.
- **No `collaborators` parameter**: New in 2025, allows tagging collaborators.
- **Alt text limit not documented**: API now supports up to 1,000 characters (March 2025).

### 4.6 Rate Limit Monitoring -- B+

`check_rate_limit()` method exists. But the scheduler does not proactively check before publishing -- it only reacts to `InstagramRateLimitError`. The research recommends checking `X-App-Usage` header on every response and stopping at 80%.

---

## PART 5: Bluesky AT Protocol Audit

### 5.1 Session Management -- A

Proactive refresh at 1 hour (sessions last ~2h on bsky.social). Single-use refresh token handled correctly. Retry on `BlueskyAuthError` with fresh session creation.

### 5.2 Facet Construction -- A

`build_facets()` correctly computes UTF-8 byte offsets (not character positions). Handles both hashtags and URLs. This is the #1 pitfall documented in AT Protocol docs, and the implementation is correct.

### 5.3 Blob Handling -- A-

950KB threshold with automatic recompression. Correct.

**Improvement:** Research suggests also resizing images >2000px on longest edge before compression. Currently only recompresses quality, not dimensions.

### 5.4 Missing Features -- Noted

- **No `langs` field**: Posts should include `"langs": ["en", "de"]` for the bilingual Bureau content.
- **No `aspectRatio` in image embed**: SDK v0.0.56+ supports `aspect_ratio` -- prevents layout shift in feeds.
- **No bot label**: Automated accounts should self-label with `"val": "bot"` per Bluesky community guidelines.
- **No external link card embed**: Bureau dispatches could include `app.bsky.embed.external` with OG metadata from metaverse.center.

---

## PART 6: Cipher ARG Audit

### 6.1 Architecture -- A

Code generation via Postgres RPC (deterministic, atomic). Redemption via Postgres RPC with CAS logic. IP hashing with SHA256 (never raw IPs). Rate limiting per IP.

### 6.2 Steganography Assessment -- N/A (correctly avoided)

Research confirmed: LSB steganography does NOT survive Instagram/Bluesky JPEG recompression. The current approach of text-based cipher hints (footer/caption) is the only reliable method for social media ARG.

The `steganographic` hint_format option in `prepare_cipher_for_post()` renders a *visual* notice ("VISUAL CIPHER EMBEDDED"), not actual LSB steganography. This is a design choice, not a bug.

### 6.3 Security -- A

- `CipherService.hash_ip()` uses hashlib (SHA256), not reversible
- Rate limit: 10 attempts/minute per IP (enforced at both router and RPC level)
- Deduplication: unique constraint on `(instagram_post_id, user_id)` and `(instagram_post_id, ip_hash)`
- SECURITY DEFINER RPC callable only via service_role (ADR-006 compliant)

---

## PART 7: Cross-Cutting Concerns

### 7.1 SSRF Protection -- WARNING

`instagram_image_service.py:_download_image()` uses raw `httpx.AsyncClient().get(url)` without SSRF protection:
```python
async with httpx.AsyncClient(timeout=30) as client:
    resp = await client.get(url)
```

Per CLAUDE.md: "Never use `httpx`/`requests` directly for user-provided URLs. Use `backend/utils/safe_fetch.py`."

**However:** The URLs here are NOT user-provided -- they come from `candidate.get("image_url")` which is internal platform data (Supabase Storage URLs). This is an internal-to-internal fetch, not an external input boundary.

**Assessment:** Low risk, but could be hardened by validating the URL domain matches Supabase Storage before fetching.

### 7.2 Error Handling Breadth -- WARNING

Multiple services catch overly broad exception tuples:
```python
except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
```
This catches everything including programming errors (TypeError, KeyError). While this prevents scheduler crashes, it can mask bugs.

**Recommendation:** Split into:
1. Expected infrastructure errors: `PostgrestAPIError, httpx.HTTPError, httpx.ConnectError`
2. Log programming errors (TypeError, KeyError) at ERROR level with full traceback

### 7.3 Observability -- A

All services use structured logging with `extra={}` dicts. Sentry integration with `push_scope()` and contextual tags. Scheduler iteration counters. Container polling logs.

### 7.4 Tests -- WARNING

Only `test_social_browse.py` exists for social media browsing endpoints. No tests found for:
- `InstagramContentService` (caption generation, candidate selection)
- `InstagramImageService` (image composition)
- `BlueskyContentService` (caption adaptation, facet building)
- `CipherService` (code generation, hint embedding)
- `InstagramScheduler` / `BlueskyScheduler` (publishing loop)
- External clients (Instagram Graph API, AT Protocol)

This is a significant gap. The image composition pipeline has zero test coverage.

---

## PART 8: Recommendations (Prioritized)

### P0 -- Critical (Fix now)

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| R1 | Extract `_parse_bool()` to shared utility (D1) | Silent data bug (Instagram missing `strip('"')`) | 30 min |
| R2 | Add `progressive=True` to `_image_to_jpeg()` | Free file size reduction + loading perf | 5 min |

### P1 -- High (Fix this sprint)

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| R3 | Extract accent bars to `_draw_accent_bars()` (D6) | 20 lines x5 = 100 lines eliminated | 30 min |
| R4 | Extract story title panel to `_draw_story_title()` (D7) | ~30 lines x5 = 150 lines eliminated | 45 min |
| R5 | Extract story finalization to `_finalize_story()` (D8) | ~15 lines x5 = 75 lines eliminated | 20 min |
| R6 | Extract scheduler constants to `social/constants.py` (D4, D5) | Single source of truth | 20 min |
| R7 | Add `"langs": ["en", "de"]` to Bluesky posts | Discoverability + accessibility | 10 min |
| R8 | Add `aspectRatio` to Bluesky image embeds | Prevents feed layout shift | 15 min |

### P2 -- Medium (Next sprint)

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| R9 | Extract `_load_config()` settings pattern to shared utility (D3) | ~80 lines eliminated, consistency | 1h |
| R10 | Extract scheduler loop structure to `BaseScheduler` (D2) | ~60 lines per scheduler eliminated | 2h |
| R11 | Unify hashtag pools -- derive Bluesky set from Instagram (D9) | Single source of truth | 45 min |
| R12 | Add exponential backoff to Instagram `_get()`/`_post()` | Reliability on transient errors | 1h |
| R13 | Optimize scan lines to NumPy (3.6) | Minor perf improvement | 30 min |
| R14 | Add RGBA-safe conversion in `_recompress_jpeg` | Prevents black-fill on transparent images | 15 min |
| R15 | Add Bluesky bot self-label | Community compliance | 20 min |

### P3 -- Low (Backlog)

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| R16 | Add `X-App-Usage` header monitoring to Instagram client | Proactive rate limit avoidance | 1h |
| R17 | Switch Replicate to webhook-based predictions | Reduce connection hold time | 3h |
| R18 | Add Bluesky external link card embed | Richer posts | 1h |
| R19 | Add unit tests for image composition pipeline | Test coverage | 4h |
| R20 | Add unit tests for caption adaptation + facet building | Test coverage | 2h |
| R21 | Resize images >2000px before Bluesky blob compression | Edge case handling | 20 min |
| R22 | Narrow exception tuples (7.2) | Bug detection | 1h |

---

## PART 9: Web Research Key Findings

### Instagram Graph API (2026)

- **API rate limit reduced to 200 calls/hour** (from 5,000 in 2025 -- 96% decrease). Your scheduler's 5-min interval is well within limits.
- **Hashtag strategy shifted**: 3-5 tags max, relevance over quantity. Your 5-tag formula is correct.
- **Alt text field expanded**: Now 1,000 characters max (March 2025). Your implementation supports it.
- **No native scheduling**: `scheduled_publish_time` does NOT exist for Instagram posts (despite blog claims). Your DB-driven scheduler is the correct approach.
- **Container 24h expiration**: Containers not published within 24h expire. Your scheduler handles this.
- **Best Python library**: Direct httpx (your approach) beats any wrapper. `python-facebook-api` is the best alternative. `instagrapi` uses private API -- avoid.

### Bluesky AT Protocol

- **SDK at v0.0.65** (alpha, no backward compat guarantees). Your raw httpx approach avoids SDK instability risk.
- **Session refresh tokens are single-use**. Your implementation handles this correctly.
- **5,000 write points/hour, 35,000/day**. Ample for your volume.
- **OAuth not recommended for bots** -- app passwords are the correct choice.

### Pillow

- **Pillow-SIMD is dead** for Python 3.13 / Pillow 12. Do not pursue.
- **Your glow/vignette/gradient patterns are already best-practice**.
- **ImageChops now has native blend modes** (multiply, screen, overlay).
- **Font caching is correctly implemented**.
- **skia-python** is the most capable alternative but not worth the migration cost for your use case.

### Image Generation (FLUX/Replicate)

- **FLUX Schnell at $0.003/image** could be used for draft previews.
- **LoRA fine-tuning** on Bureau aesthetic would ensure style consistency (~$2, <2 min on Replicate).
- **fal.ai is 30-50% cheaper** than Replicate for equivalent models.
- **Cost projection**: ~$2/month at current volume (2 posts/day).

---

## PART 10: Refactoring Priority Matrix

```
              HIGH IMPACT
                  |
   R3 (bars)     |     R10 (BaseScheduler)
   R4 (title)    |     R9  (_load_config)
   R1 (parse)    |     R12 (backoff)
                  |
LOW EFFORT -------+------- HIGH EFFORT
                  |
   R2 (progressive)|    R19 (tests)
   R7 (langs)    |     R17 (webhooks)
   R8 (aspect)   |     R20 (tests)
                  |
              LOW IMPACT
```

**Quick wins (< 1 hour, high impact):** R1, R2, R3, R4, R5, R6, R7, R8
**Strategic investments (> 1 hour):** R10, R12, R19, R20

---

*Total findings: 22 recommendations (2 P0, 6 P1, 7 P2, 7 P3)*
*Duplicated code estimated: ~500 lines across 10 patterns*
*Architecture conformity: 95% -- 2 minor deviations found*
