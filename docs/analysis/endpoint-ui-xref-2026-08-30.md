# metaverse.center — Backend Endpoint <-> Frontend UI Cross-Reference

Mechanical audit. Backend: `backend/routers/*.py` (60 files, 1 empty `__init__.py`). Frontend: `frontend/src/services/api/*.ts` (52 files) + components under `frontend/src/`. 576 backend endpoints extracted via regex over `@router.get/post/put/patch/delete(...)` decorators + `APIRouter(prefix=...)`. Frontend call sites extracted via regex over `this.get/post/put/patch/delete/getPublic/getSimulationData/postFormData(...)` in the api-service layer, with `CrudApiService` base-class methods (list/getById/create/update/remove/listPublic/getBySlug) synthesized per subclass from its `resource` field. Matched by (METHOD, path-with-`{param}`-normalized-to-`*`).

Three manual corrections were applied on top of the mechanical match (documented at point of use): (1) `ForgeApiService.listFeaturePurchases` — a file-scoped local-`const params` collision in the extractor's (deliberately non-lexically-scoped) local-variable resolver masked a real match to `GET .../forge/simulations/{id}/features`; (2)+(3) the chat SSE endpoints (`.../messages/stream`, `.../regenerate`) are called via raw `fetch()` in `frontend/src/services/chat/ChatStreamConsumer.ts`, bypassing `BaseApiService` entirely (necessary for streaming reads), so the path-based extractor cannot see them.

## Task 1 — Endpoint Inventory (all 576 endpoints, by router file)

| Router file | Router prefix(es) | Count |
|---|---|---|
| `backend/routers/achievements.py` | `/api/v1` | 4 |
| `backend/routers/admin.py` | `/api/v1/admin` | 29 |
| `backend/routers/admin_content_packs.py` | `/api/v1/admin/content-packs` | 2 |
| `backend/routers/admin_drafts.py` | `/api/v1/admin/content-drafts` | 12 |
| `backend/routers/admin_ops.py` | `/api/v1/admin/ops` | 18 |
| `backend/routers/agent_autonomy.py` | `/api/v1/simulations/{simulation_id}` | 8 |
| `backend/routers/agent_memories.py` | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories` | 2 |
| `backend/routers/agent_professions.py` | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions` | 4 |
| `backend/routers/agents.py` | `/api/v1/simulations/{simulation_id}/agents` | 7 |
| `backend/routers/aptitudes.py` | `/api/v1/simulations/{simulation_id}` | 3 |
| `backend/routers/bluesky.py` | `/api/v1/admin/bluesky` | 8 |
| `backend/routers/bonds.py` | `/api/v1/bonds` | 8 |
| `backend/routers/bot_players.py` | `/api/v1/bot-players` | 5 |
| `backend/routers/broadsheets.py` | `/api/v1/simulations/{simulation_id}/broadsheets` | 4 |
| `backend/routers/buildings.py` | `/api/v1/simulations/{simulation_id}/buildings` | 11 |
| `backend/routers/campaigns.py` | `/api/v1/simulations/{simulation_id}/campaigns` | 9 |
| `backend/routers/chat.py` | `/api/v1/simulations/{simulation_id}/chat` | 17 |
| `backend/routers/chronicles.py` | `/api/v1/simulations/{simulation_id}/chronicles` | 3 |
| `backend/routers/cipher.py` | `/api/v1/admin/instagram`, `/api/v1/public/bureau` | 3 |
| `backend/routers/connections.py` | `/api/v1/connections` | 4 |
| `backend/routers/drift.py` | `/api/v1/drift` | 20 |
| `backend/routers/dungeon_content_admin.py` | `/api/v1/admin/dungeon-content` | 6 |
| `backend/routers/echoes.py` | `/api/v1/simulations/{simulation_id}` | 5 |
| `backend/routers/embassies.py` | `/api/v1/simulations/{simulation_id}` | 10 |
| `backend/routers/epoch_chat.py` | `/api/v1/epochs/{epoch_id}/chat` | 3 |
| `backend/routers/epoch_invitations.py` | `/api/v1/epochs/{epoch_id}/invitations` | 4 |
| `backend/routers/epochs.py` | `/api/v1/epochs` | 32 |
| `backend/routers/events.py` | `/api/v1/simulations/{simulation_id}/events` | 15 |
| `backend/routers/forge.py` | `/api/v1/forge` | 41 |
| `backend/routers/forge_access.py` | `/api/v1/forge/access-requests` | 5 |
| `backend/routers/game_mechanics.py` | `/api/v1/simulations/{simulation_id}` | 8 |
| `backend/routers/generation.py` | `/api/v1/simulations/{simulation_id}/generate` | 7 |
| `backend/routers/health.py` | `/api/v1` | 1 |
| `backend/routers/heartbeat.py` | `(none)` | 18 |
| `backend/routers/instagram.py` | `/api/v1/admin/instagram` | 12 |
| `backend/routers/invitations.py` | `(none)` | 4 |
| `backend/routers/journal.py` | `/api/v1/journal` | 11 |
| `backend/routers/locations.py` | `/api/v1/simulations/{simulation_id}/locations` | 11 |
| `backend/routers/members.py` | `/api/v1/simulations/{simulation_id}/members` | 4 |
| `backend/routers/news_scanner.py` | `/api/v1/admin/news-scanner` | 9 |
| `backend/routers/operatives.py` | `/api/v1/epochs/{epoch_id}/operatives` | 8 |
| `backend/routers/prompt_templates.py` | `/api/v1/simulations/{simulation_id}/prompt-templates` | 6 |
| `backend/routers/public.py` | `/api/v1/public` | 74 |
| `backend/routers/relationships.py` | `/api/v1/simulations/{simulation_id}` | 5 |
| `backend/routers/resonance_dungeons.py` | `/api/v1/dungeons` | 19 |
| `backend/routers/resonances.py` | `/api/v1/resonances` | 9 |
| `backend/routers/scores.py` | `/api/v1/epochs/{epoch_id}/scores` | 5 |
| `backend/routers/seo.py` | `(none)` | 3 |
| `backend/routers/settings.py` | `/api/v1/simulations/{simulation_id}/settings` | 6 |
| `backend/routers/simulations.py` | `/api/v1/simulations` | 10 |
| `backend/routers/social_media.py` | `/api/v1/simulations/{simulation_id}/social-media` | 6 |
| `backend/routers/social_stories.py` | `/api/v1/admin/instagram/stories` | 9 |
| `backend/routers/social_trends.py` | `/api/v1/simulations/{simulation_id}/social-trends` | 10 |
| `backend/routers/style_references.py` | `/api/v1/simulations/{simulation_id}/style-references` | 3 |
| `backend/routers/taxonomies.py` | `/api/v1/simulations/{simulation_id}/taxonomies` | 5 |
| `backend/routers/users.py` | `/api/v1/users` | 5 |
| `backend/routers/webhooks.py` | `/api/v1/webhooks` | 1 |
| `backend/routers/world_map.py` | `/api/v1/admin`, `/api/v1/public` | 2 |
| `backend/routers/zone_actions.py` | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions` | 3 |
| **TOTAL (59 routers + empty `__init__.py`)** | | **576** |

### Full endpoint list (method, full path, file:line)

| Method | Path | File:Line |
|---|---|---|
| GET | `/api/v1/achievements/definitions` | `backend/routers/achievements.py:29` |
| GET | `/api/v1/users/me/achievements` | `backend/routers/achievements.py:43` |
| GET | `/api/v1/users/me/achievements/progress` | `backend/routers/achievements.py:57` |
| GET | `/api/v1/users/me/achievements/summary` | `backend/routers/achievements.py:70` |
| GET | `/api/v1/admin/environment` | `backend/routers/admin.py:139` |
| GET | `/api/v1/admin/settings` | `backend/routers/admin.py:150` |
| PUT | `/api/v1/admin/settings/{key}` | `backend/routers/admin.py:160` |
| GET | `/api/v1/admin/users` | `backend/routers/admin.py:209` |
| GET | `/api/v1/admin/users/{user_id}` | `backend/routers/admin.py:221` |
| DELETE | `/api/v1/admin/users/{user_id}` | `backend/routers/admin.py:232` |
| POST | `/api/v1/admin/users/{user_id}/memberships` | `backend/routers/admin.py:253` |
| PUT | `/api/v1/admin/users/{user_id}/memberships/{simulation_id}` | `backend/routers/admin.py:279` |
| DELETE | `/api/v1/admin/users/{user_id}/memberships/{simulation_id}` | `backend/routers/admin.py:306` |
| PUT | `/api/v1/admin/users/{user_id}/wallet` | `backend/routers/admin.py:326` |
| GET | `/api/v1/admin/cleanup/stats` | `backend/routers/admin.py:357` |
| POST | `/api/v1/admin/cleanup/preview` | `backend/routers/admin.py:367` |
| POST | `/api/v1/admin/cleanup/execute` | `backend/routers/admin.py:383` |
| GET | `/api/v1/admin/simulations` | `backend/routers/admin.py:414` |
| GET | `/api/v1/admin/simulations/deleted` | `backend/routers/admin.py:433` |
| POST | `/api/v1/admin/simulations/{simulation_id}/restore` | `backend/routers/admin.py:450` |
| DELETE | `/api/v1/admin/simulations/{simulation_id}` | `backend/routers/admin.py:469` |
| GET | `/api/v1/admin/health-effects` | `backend/routers/admin.py:504` |
| PUT | `/api/v1/admin/health-effects/simulations/{simulation_id}` | `backend/routers/admin.py:514` |
| GET | `/api/v1/admin/dungeon-config/global` | `backend/routers/admin.py:547` |
| PUT | `/api/v1/admin/dungeon-config/global` | `backend/routers/admin.py:557` |
| GET | `/api/v1/admin/dungeon-override` | `backend/routers/admin.py:587` |
| GET | `/api/v1/admin/dungeon-override/simulations/{simulation_id}` | `backend/routers/admin.py:601` |
| PUT | `/api/v1/admin/dungeon-override/simulations/{simulation_id}` | `backend/routers/admin.py:612` |
| POST | `/api/v1/admin/impersonate` | `backend/routers/admin.py:651` |
| GET | `/api/v1/admin/ai-usage/stats` | `backend/routers/admin.py:704` |
| POST | `/api/v1/admin/dungeon-showcase/generate-image` | `backend/routers/admin.py:727` |
| POST | `/api/v1/admin/simulations/{simulation_id}/regenerate-lore` | `backend/routers/admin.py:758` |
| POST | `/api/v1/admin/simulations/{simulation_id}/regenerate-images` | `backend/routers/admin.py:854` |
| GET | `/api/v1/admin/content-packs` | `backend/routers/admin_content_packs.py:44` |
| GET | `/api/v1/admin/content-packs/{pack_slug}/{resource_path}` | `backend/routers/admin_content_packs.py:57` |
| GET | `/api/v1/admin/content-drafts` | `backend/routers/admin_drafts.py:96` |
| GET | `/api/v1/admin/content-drafts/open-for-resource` | `backend/routers/admin_drafts.py:126` |
| GET | `/api/v1/admin/content-drafts/by-pr/{pr_number}` | `backend/routers/admin_drafts.py:164` |
| GET | `/api/v1/admin/content-drafts/{draft_id}` | `backend/routers/admin_drafts.py:184` |
| POST | `/api/v1/admin/content-drafts` | `backend/routers/admin_drafts.py:200` |
| PATCH | `/api/v1/admin/content-drafts/{draft_id}` | `backend/routers/admin_drafts.py:227` |
| DELETE | `/api/v1/admin/content-drafts/{draft_id}` | `backend/routers/admin_drafts.py:255` |
| GET | `/api/v1/admin/content-drafts/{draft_id}/conflict-preview` | `backend/routers/admin_drafts.py:292` |
| POST | `/api/v1/admin/content-drafts/{draft_id}/resolve` | `backend/routers/admin_drafts.py:315` |
| POST | `/api/v1/admin/content-drafts/publish` | `backend/routers/admin_drafts.py:358` |
| POST | `/api/v1/admin/content-drafts/sweep-orphans` | `backend/routers/admin_drafts.py:400` |
| POST | `/api/v1/admin/content-drafts/orphan-sweeper/run-now` | `backend/routers/admin_drafts.py:451` |
| GET | `/api/v1/admin/ops/ledger` | `backend/routers/admin_ops.py:78` |
| GET | `/api/v1/admin/ops/firehose` | `backend/routers/admin_ops.py:88` |
| GET | `/api/v1/admin/ops/circuit` | `backend/routers/admin_ops.py:99` |
| GET | `/api/v1/admin/ops/heatmap` | `backend/routers/admin_ops.py:109` |
| GET | `/api/v1/admin/ops/audit` | `backend/routers/admin_ops.py:131` |
| GET | `/api/v1/admin/ops/forecast` | `backend/routers/admin_ops.py:143` |
| GET | `/api/v1/admin/ops/budgets` | `backend/routers/admin_ops.py:163` |
| POST | `/api/v1/admin/ops/budget` | `backend/routers/admin_ops.py:173` |
| PUT | `/api/v1/admin/ops/budget/{budget_id}` | `backend/routers/admin_ops.py:186` |
| DELETE | `/api/v1/admin/ops/budget/{budget_id}` | `backend/routers/admin_ops.py:200` |
| POST | `/api/v1/admin/ops/kill` | `backend/routers/admin_ops.py:217` |
| POST | `/api/v1/admin/ops/revert` | `backend/routers/admin_ops.py:231` |
| POST | `/api/v1/admin/ops/kill/cut-all-ai` | `backend/routers/admin_ops.py:242` |
| POST | `/api/v1/admin/ops/circuit/reset` | `backend/routers/admin_ops.py:266` |
| GET | `/api/v1/admin/ops/sentry/rules` | `backend/routers/admin_ops.py:306` |
| POST | `/api/v1/admin/ops/sentry/rules` | `backend/routers/admin_ops.py:316` |
| PUT | `/api/v1/admin/ops/sentry/rules/{rule_id}` | `backend/routers/admin_ops.py:332` |
| DELETE | `/api/v1/admin/ops/sentry/rules/{rule_id}` | `backend/routers/admin_ops.py:346` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/mood` | `backend/routers/agent_autonomy.py:45` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/moodlets` | `backend/routers/agent_autonomy.py:58` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/needs` | `backend/routers/agent_autonomy.py:74` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/opinions` | `backend/routers/agent_autonomy.py:90` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/opinion-modifiers` | `backend/routers/agent_autonomy.py:103` |
| GET | `/api/v1/simulations/{simulation_id}/activities` | `backend/routers/agent_autonomy.py:125` |
| GET | `/api/v1/simulations/{simulation_id}/mood-summary` | `backend/routers/agent_autonomy.py:156` |
| GET | `/api/v1/simulations/{simulation_id}/briefing` | `backend/routers/agent_autonomy.py:174` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories` | `backend/routers/agent_memories.py:26` |
| POST | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories/reflect` | `backend/routers/agent_memories.py:50` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions` | `backend/routers/agent_professions.py:28` |
| POST | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions` | `backend/routers/agent_professions.py:41` |
| PUT | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions/{profession_id}` | `backend/routers/agent_professions.py:56` |
| DELETE | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions/{profession_id}` | `backend/routers/agent_professions.py:78` |
| GET | `/api/v1/simulations/{simulation_id}/agents` | `backend/routers/agents.py:36` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}` | `backend/routers/agents.py:63` |
| POST | `/api/v1/simulations/{simulation_id}/agents` | `backend/routers/agents.py:76` |
| PUT | `/api/v1/simulations/{simulation_id}/agents/{agent_id}` | `backend/routers/agents.py:92` |
| DELETE | `/api/v1/simulations/{simulation_id}/agents/{agent_id}` | `backend/routers/agents.py:120` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/reactions` | `backend/routers/agents.py:135` |
| DELETE | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/reactions/{reaction_id}` | `backend/routers/agents.py:148` |
| GET | `/api/v1/simulations/{simulation_id}/aptitudes` | `backend/routers/aptitudes.py:27` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/aptitudes` | `backend/routers/aptitudes.py:42` |
| PUT | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/aptitudes` | `backend/routers/aptitudes.py:55` |
| GET | `/api/v1/admin/bluesky/queue` | `backend/routers/bluesky.py:52` |
| GET | `/api/v1/admin/bluesky/queue/{post_id}` | `backend/routers/bluesky.py:70` |
| POST | `/api/v1/admin/bluesky/queue/{post_id}/skip` | `backend/routers/bluesky.py:84` |
| POST | `/api/v1/admin/bluesky/queue/{post_id}/unskip` | `backend/routers/bluesky.py:114` |
| POST | `/api/v1/admin/bluesky/queue/{post_id}/publish` | `backend/routers/bluesky.py:147` |
| GET | `/api/v1/admin/bluesky/analytics` | `backend/routers/bluesky.py:191` |
| GET | `/api/v1/admin/bluesky/settings` | `backend/routers/bluesky.py:205` |
| GET | `/api/v1/admin/bluesky/status` | `backend/routers/bluesky.py:218` |
| GET | `/api/v1/bonds` | `backend/routers/bonds.py:47` |
| GET | `/api/v1/bonds/recognition-candidates` | `backend/routers/bonds.py:59` |
| POST | `/api/v1/bonds/track-attention` | `backend/routers/bonds.py:76` |
| POST | `/api/v1/bonds/form` | `backend/routers/bonds.py:100` |
| GET | `/api/v1/bonds/{bond_id}` | `backend/routers/bonds.py:125` |
| GET | `/api/v1/bonds/{bond_id}/whispers` | `backend/routers/bonds.py:136` |
| POST | `/api/v1/bonds/{bond_id}/whispers/{whisper_id}/read` | `backend/routers/bonds.py:151` |
| POST | `/api/v1/bonds/{bond_id}/whispers/{whisper_id}/acted` | `backend/routers/bonds.py:170` |
| GET | `/api/v1/bot-players` | `backend/routers/bot_players.py:22` |
| GET | `/api/v1/bot-players/{bot_id}` | `backend/routers/bot_players.py:32` |
| POST | `/api/v1/bot-players` | `backend/routers/bot_players.py:43` |
| PATCH | `/api/v1/bot-players/{bot_id}` | `backend/routers/bot_players.py:72` |
| DELETE | `/api/v1/bot-players/{bot_id}` | `backend/routers/bot_players.py:92` |
| POST | `/api/v1/simulations/{simulation_id}/broadsheets` | `backend/routers/broadsheets.py:26` |
| GET | `/api/v1/simulations/{simulation_id}/broadsheets` | `backend/routers/broadsheets.py:59` |
| GET | `/api/v1/simulations/{simulation_id}/broadsheets/latest` | `backend/routers/broadsheets.py:74` |
| GET | `/api/v1/simulations/{simulation_id}/broadsheets/{broadsheet_id}` | `backend/routers/broadsheets.py:87` |
| GET | `/api/v1/simulations/{simulation_id}/buildings` | `backend/routers/buildings.py:39` |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}` | `backend/routers/buildings.py:68` |
| POST | `/api/v1/simulations/{simulation_id}/buildings` | `backend/routers/buildings.py:81` |
| PUT | `/api/v1/simulations/{simulation_id}/buildings/{building_id}` | `backend/routers/buildings.py:97` |
| DELETE | `/api/v1/simulations/{simulation_id}/buildings/{building_id}` | `backend/routers/buildings.py:125` |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/agents` | `backend/routers/buildings.py:139` |
| POST | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/assign-agent` | `backend/routers/buildings.py:152` |
| DELETE | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/unassign-agent` | `backend/routers/buildings.py:168` |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/profession-requirements` | `backend/routers/buildings.py:183` |
| POST | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/profession-requirements` | `backend/routers/buildings.py:196` |
| GET | `/api/v1/simulations/{simulation_id}/buildings/by-zone/{zone_id}` | `backend/routers/buildings.py:224` |
| GET | `/api/v1/simulations/{simulation_id}/campaigns` | `backend/routers/campaigns.py:37` |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}` | `backend/routers/campaigns.py:58` |
| POST | `/api/v1/simulations/{simulation_id}/campaigns` | `backend/routers/campaigns.py:71` |
| PUT | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}` | `backend/routers/campaigns.py:90` |
| DELETE | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}` | `backend/routers/campaigns.py:110` |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/analytics` | `backend/routers/campaigns.py:124` |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/events` | `backend/routers/campaigns.py:137` |
| POST | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/events` | `backend/routers/campaigns.py:150` |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/metrics` | `backend/routers/campaigns.py:171` |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations` | `backend/routers/chat.py:41` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations` | `backend/routers/chat.py:53` |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages` | `backend/routers/chat.py:81` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages` | `backend/routers/chat.py:97` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages/stream` | `backend/routers/chat.py:149` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/regenerate` | `backend/routers/chat.py:224` |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/starters` | `backend/routers/chat.py:288` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/agents` | `backend/routers/chat.py:313` |
| DELETE | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/agents/{agent_id}` | `backend/routers/chat.py:340` |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/events` | `backend/routers/chat.py:364` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/events` | `backend/routers/chat.py:378` |
| DELETE | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/events/{event_id}` | `backend/routers/chat.py:410` |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages/{message_id}/reactions` | `backend/routers/chat.py:434` |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages/{message_id}/reactions` | `backend/routers/chat.py:470` |
| PUT | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/title` | `backend/routers/chat.py:488` |
| PATCH | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}` | `backend/routers/chat.py:512` |
| DELETE | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}` | `backend/routers/chat.py:534` |
| POST | `/api/v1/simulations/{simulation_id}/chronicles` | `backend/routers/chronicles.py:26` |
| GET | `/api/v1/simulations/{simulation_id}/chronicles` | `backend/routers/chronicles.py:62` |
| GET | `/api/v1/simulations/{simulation_id}/chronicles/{chronicle_id}` | `backend/routers/chronicles.py:77` |
| POST | `/api/v1/public/bureau/dispatch` | `backend/routers/cipher.py:43` |
| GET | `/api/v1/admin/instagram/ciphers` | `backend/routers/cipher.py:126` |
| POST | `/api/v1/admin/instagram/{post_id}/cipher` | `backend/routers/cipher.py:136` |
| GET | `/api/v1/connections` | `backend/routers/connections.py:24` |
| POST | `/api/v1/connections` | `backend/routers/connections.py:34` |
| PATCH | `/api/v1/connections/{connection_id}` | `backend/routers/connections.py:56` |
| DELETE | `/api/v1/connections/{connection_id}` | `backend/routers/connections.py:80` |
| GET | `/api/v1/drift/chart` | `backend/routers/drift.py:90` |
| GET | `/api/v1/drift/tuning` | `backend/routers/drift.py:100` |
| GET | `/api/v1/drift/honors` | `backend/routers/drift.py:110` |
| GET | `/api/v1/drift/dock/{simulation_id}` | `backend/routers/drift.py:122` |
| POST | `/api/v1/drift/admin/regenerate` | `backend/routers/drift.py:133` |
| GET | `/api/v1/drift/profile` | `backend/routers/drift.py:148` |
| POST | `/api/v1/drift/clearance-exam` | `backend/routers/drift.py:165` |
| GET | `/api/v1/drift/run` | `backend/routers/drift.py:182` |
| POST | `/api/v1/drift/run` | `backend/routers/drift.py:193` |
| POST | `/api/v1/drift/run/{run_id}/move` | `backend/routers/drift.py:205` |
| POST | `/api/v1/drift/run/{run_id}/complete` | `backend/routers/drift.py:218` |
| POST | `/api/v1/drift/run/{run_id}/havarie/resolve` | `backend/routers/drift.py:231` |
| POST | `/api/v1/drift/run/{run_id}/signal/resolve` | `backend/routers/drift.py:261` |
| POST | `/api/v1/drift/run/{run_id}/sondieren` | `backend/routers/drift.py:287` |
| POST | `/api/v1/drift/run/{run_id}/bank` | `backend/routers/drift.py:304` |
| GET | `/api/v1/drift/logbook` | `backend/routers/drift.py:317` |
| POST | `/api/v1/drift/run/{run_id}/abandon` | `backend/routers/drift.py:334` |
| GET | `/api/v1/drift/quests` | `backend/routers/drift.py:350` |
| POST | `/api/v1/drift/quests/accept` | `backend/routers/drift.py:361` |
| POST | `/api/v1/drift/quests/{instance_id}/advance` | `backend/routers/drift.py:375` |
| GET | `/api/v1/admin/dungeon-content/{content_type}` | `backend/routers/dungeon_content_admin.py:66` |
| GET | `/api/v1/admin/dungeon-content/{content_type}/{item_id}` | `backend/routers/dungeon_content_admin.py:89` |
| PUT | `/api/v1/admin/dungeon-content/{content_type}/{item_id}` | `backend/routers/dungeon_content_admin.py:101` |
| POST | `/api/v1/admin/dungeon-content/reload-cache` | `backend/routers/dungeon_content_admin.py:126` |
| POST | `/api/v1/admin/dungeon-content/{content_type}` | `backend/routers/dungeon_content_admin.py:146` |
| DELETE | `/api/v1/admin/dungeon-content/{content_type}/{item_id}` | `backend/routers/dungeon_content_admin.py:170` |
| GET | `/api/v1/simulations/{simulation_id}/echoes` | `backend/routers/echoes.py:57` |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/echoes` | `backend/routers/echoes.py:80` |
| POST | `/api/v1/simulations/{simulation_id}/echoes` | `backend/routers/echoes.py:93` |
| PATCH | `/api/v1/simulations/{simulation_id}/echoes/{echo_id}/approve` | `backend/routers/echoes.py:136` |
| PATCH | `/api/v1/simulations/{simulation_id}/echoes/{echo_id}/reject` | `backend/routers/echoes.py:199` |
| GET | `/api/v1/simulations/{simulation_id}/embassies` | `backend/routers/embassies.py:35` |
| GET | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}` | `backend/routers/embassies.py:56` |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/embassy` | `backend/routers/embassies.py:69` |
| POST | `/api/v1/simulations/{simulation_id}/embassies` | `backend/routers/embassies.py:82` |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}` | `backend/routers/embassies.py:102` |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/activate` | `backend/routers/embassies.py:123` |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/suspend` | `backend/routers/embassies.py:139` |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/dissolve` | `backend/routers/embassies.py:155` |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/ward` | `backend/routers/embassies.py:174` |
| DELETE | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/ward` | `backend/routers/embassies.py:195` |
| POST | `/api/v1/epochs/{epoch_id}/chat` | `backend/routers/epoch_chat.py:45` |
| GET | `/api/v1/epochs/{epoch_id}/chat` | `backend/routers/epoch_chat.py:77` |
| GET | `/api/v1/epochs/{epoch_id}/chat/team/{team_id}` | `backend/routers/epoch_chat.py:98` |
| POST | `/api/v1/epochs/{epoch_id}/invitations` | `backend/routers/epoch_invitations.py:44` |
| GET | `/api/v1/epochs/{epoch_id}/invitations` | `backend/routers/epoch_invitations.py:72` |
| DELETE | `/api/v1/epochs/{epoch_id}/invitations/{invitation_id}` | `backend/routers/epoch_invitations.py:84` |
| POST | `/api/v1/epochs/{epoch_id}/invitations/regenerate-lore` | `backend/routers/epoch_invitations.py:100` |
| GET | `/api/v1/epochs` | `backend/routers/epochs.py:63` |
| GET | `/api/v1/epochs/active` | `backend/routers/epochs.py:79` |
| GET | `/api/v1/epochs/{epoch_id}` | `backend/routers/epochs.py:89` |
| POST | `/api/v1/epochs` | `backend/routers/epochs.py:100` |
| PATCH | `/api/v1/epochs/{epoch_id}` | `backend/routers/epochs.py:126` |
| POST | `/api/v1/epochs/quick-academy` | `backend/routers/epochs.py:140` |
| POST | `/api/v1/epochs/{epoch_id}/start` | `backend/routers/epochs.py:166` |
| POST | `/api/v1/epochs/{epoch_id}/advance` | `backend/routers/epochs.py:192` |
| POST | `/api/v1/epochs/{epoch_id}/cancel` | `backend/routers/epochs.py:214` |
| DELETE | `/api/v1/epochs/{epoch_id}` | `backend/routers/epochs.py:237` |
| GET | `/api/v1/epochs/{epoch_id}/instances` | `backend/routers/epochs.py:259` |
| GET | `/api/v1/epochs/{epoch_id}/battle-log/summary` | `backend/routers/epochs.py:270` |
| GET | `/api/v1/epochs/{epoch_id}/sitrep/{cycle_number}` | `backend/routers/epochs.py:288` |
| GET | `/api/v1/epochs/{epoch_id}/battle-log` | `backend/routers/epochs.py:306` |
| GET | `/api/v1/epochs/{epoch_id}/results-summary` | `backend/routers/epochs.py:345` |
| POST | `/api/v1/epochs/{epoch_id}/resolve-cycle` | `backend/routers/epochs.py:357` |
| POST | `/api/v1/epochs/{epoch_id}/pass-cycle` | `backend/routers/epochs.py:380` |
| GET | `/api/v1/epochs/{epoch_id}/participants` | `backend/routers/epochs.py:401` |
| POST | `/api/v1/epochs/{epoch_id}/participants` | `backend/routers/epochs.py:415` |
| DELETE | `/api/v1/epochs/{epoch_id}/participants/{simulation_id}` | `backend/routers/epochs.py:442` |
| POST | `/api/v1/epochs/{epoch_id}/participants/{simulation_id}/draft` | `backend/routers/epochs.py:466` |
| POST | `/api/v1/epochs/{epoch_id}/add-bot` | `backend/routers/epochs.py:500` |
| DELETE | `/api/v1/epochs/{epoch_id}/remove-bot/{participant_id}` | `backend/routers/epochs.py:526` |
| GET | `/api/v1/epochs/{epoch_id}/teams` | `backend/routers/epochs.py:557` |
| POST | `/api/v1/epochs/{epoch_id}/teams` | `backend/routers/epochs.py:570` |
| POST | `/api/v1/epochs/{epoch_id}/teams/{team_id}/join` | `backend/routers/epochs.py:600` |
| POST | `/api/v1/epochs/{epoch_id}/teams/leave` | `backend/routers/epochs.py:623` |
| GET | `/api/v1/epochs/{epoch_id}/proposals` | `backend/routers/epochs.py:648` |
| POST | `/api/v1/epochs/{epoch_id}/proposals` | `backend/routers/epochs.py:668` |
| POST | `/api/v1/epochs/{epoch_id}/teams/{team_id}/invite` | `backend/routers/epochs.py:703` |
| POST | `/api/v1/epochs/{epoch_id}/proposals/{proposal_id}/vote` | `backend/routers/epochs.py:741` |
| POST | `/api/v1/epochs/{epoch_id}/ready` | `backend/routers/epochs.py:779` |
| GET | `/api/v1/simulations/{simulation_id}/events` | `backend/routers/events.py:44` |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}` | `backend/routers/events.py:75` |
| POST | `/api/v1/simulations/{simulation_id}/events` | `backend/routers/events.py:88` |
| PUT | `/api/v1/simulations/{simulation_id}/events/{event_id}` | `backend/routers/events.py:103` |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}` | `backend/routers/events.py:126` |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/reactions` | `backend/routers/events.py:141` |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/reactions` | `backend/routers/events.py:154` |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}/reactions/{reaction_id}` | `backend/routers/events.py:182` |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/generate-reactions` | `backend/routers/events.py:197` |
| PUT | `/api/v1/simulations/{simulation_id}/events/{event_id}/status` | `backend/routers/events.py:233` |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/chains` | `backend/routers/events.py:257` |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/chains` | `backend/routers/events.py:270` |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}/chains/{chain_id}` | `backend/routers/events.py:300` |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/zone-links` | `backend/routers/events.py:314` |
| GET | `/api/v1/simulations/{simulation_id}/events/by-tags/{tags}` | `backend/routers/events.py:327` |
| GET | `/api/v1/forge/drafts` | `backend/routers/forge.py:93` |
| POST | `/api/v1/forge/drafts` | `backend/routers/forge.py:105` |
| GET | `/api/v1/forge/drafts/{draft_id}` | `backend/routers/forge.py:127` |
| PATCH | `/api/v1/forge/drafts/{draft_id}` | `backend/routers/forge.py:138` |
| DELETE | `/api/v1/forge/drafts/{draft_id}` | `backend/routers/forge.py:169` |
| POST | `/api/v1/forge/drafts/{draft_id}/research` | `backend/routers/forge.py:188` |
| POST | `/api/v1/forge/drafts/{draft_id}/generate/{chunk_type}` | `backend/routers/forge.py:209` |
| POST | `/api/v1/forge/drafts/{draft_id}/generate-entity/{entity_type}` | `backend/routers/forge.py:232` |
| POST | `/api/v1/forge/drafts/{draft_id}/generate-theme` | `backend/routers/forge.py:259` |
| POST | `/api/v1/forge/drafts/{draft_id}/ignite` | `backend/routers/forge.py:280` |
| GET | `/api/v1/forge/bundles` | `backend/routers/forge.py:321` |
| GET | `/api/v1/forge/wallet` | `backend/routers/forge.py:331` |
| POST | `/api/v1/forge/wallet/purchase` | `backend/routers/forge.py:344` |
| GET | `/api/v1/forge/wallet/history` | `backend/routers/forge.py:366` |
| PUT | `/api/v1/forge/wallet/keys` | `backend/routers/forge.py:383` |
| DELETE | `/api/v1/forge/wallet/keys/{provider}` | `backend/routers/forge.py:410` |
| POST | `/api/v1/forge/wallet/keys/test` | `backend/routers/forge.py:440` |
| GET | `/api/v1/forge/simulations/{simulation_id}/features` | `backend/routers/forge.py:472` |
| POST | `/api/v1/forge/simulations/{simulation_id}/darkroom` | `backend/routers/forge.py:491` |
| POST | `/api/v1/forge/simulations/{simulation_id}/generate-missing-images` | `backend/routers/forge.py:532` |
| POST | `/api/v1/forge/simulations/{simulation_id}/darkroom/regenerate/{entity_type}/{entity_id}` | `backend/routers/forge.py:588` |
| POST | `/api/v1/forge/simulations/{simulation_id}/dossier` | `backend/routers/forge.py:658` |
| POST | `/api/v1/forge/simulations/{simulation_id}/dossier/evolve` | `backend/routers/forge.py:701` |
| POST | `/api/v1/forge/simulations/{simulation_id}/recruit` | `backend/routers/forge.py:750` |
| POST | `/api/v1/forge/simulations/{simulation_id}/chronicle` | `backend/routers/forge.py:800` |
| POST | `/api/v1/forge/simulations/{simulation_id}/chronicle/hires` | `backend/routers/forge.py:840` |
| GET | `/api/v1/forge/features/{purchase_id}` | `backend/routers/forge.py:880` |
| GET | `/api/v1/forge/admin/stats` | `backend/routers/forge.py:898` |
| DELETE | `/api/v1/forge/admin/purge` | `backend/routers/forge.py:908` |
| GET | `/api/v1/forge/admin/economy` | `backend/routers/forge.py:930` |
| GET | `/api/v1/forge/admin/bundles` | `backend/routers/forge.py:940` |
| PUT | `/api/v1/forge/admin/bundles/{bundle_id}` | `backend/routers/forge.py:950` |
| GET | `/api/v1/forge/admin/purchases` | `backend/routers/forge.py:974` |
| POST | `/api/v1/forge/admin/grant` | `backend/routers/forge.py:992` |
| GET | `/api/v1/forge/admin/byok-setting` | `backend/routers/forge.py:1017` |
| PUT | `/api/v1/forge/admin/byok-setting` | `backend/routers/forge.py:1027` |
| PUT | `/api/v1/forge/admin/byok-access-policy` | `backend/routers/forge.py:1047` |
| PUT | `/api/v1/forge/admin/user-byok-bypass/{target_user_id}` | `backend/routers/forge.py:1067` |
| PUT | `/api/v1/forge/admin/user-byok-allowed/{target_user_id}` | `backend/routers/forge.py:1088` |
| POST | `/api/v1/forge/admin/regenerate-images/{simulation_id}` | `backend/routers/forge.py:1118` |
| POST | `/api/v1/forge/admin/retrigger-batch/{simulation_id}` | `backend/routers/forge.py:1172` |
| POST | `/api/v1/forge/access-requests` | `backend/routers/forge_access.py:35` |
| GET | `/api/v1/forge/access-requests/me` | `backend/routers/forge_access.py:59` |
| GET | `/api/v1/forge/access-requests/pending` | `backend/routers/forge_access.py:69` |
| GET | `/api/v1/forge/access-requests/pending/count` | `backend/routers/forge_access.py:79` |
| POST | `/api/v1/forge/access-requests/{request_id}/review` | `backend/routers/forge_access.py:89` |
| GET | `/api/v1/simulations/{simulation_id}/health` | `backend/routers/game_mechanics.py:35` |
| GET | `/api/v1/simulations/{simulation_id}/health/simulation` | `backend/routers/game_mechanics.py:47` |
| GET | `/api/v1/simulations/{simulation_id}/health/buildings` | `backend/routers/game_mechanics.py:59` |
| GET | `/api/v1/simulations/{simulation_id}/health/buildings/{building_id}` | `backend/routers/game_mechanics.py:84` |
| GET | `/api/v1/simulations/{simulation_id}/health/zones` | `backend/routers/game_mechanics.py:101` |
| GET | `/api/v1/simulations/{simulation_id}/health/zones/{zone_id}` | `backend/routers/game_mechanics.py:113` |
| GET | `/api/v1/simulations/{simulation_id}/health/embassies` | `backend/routers/game_mechanics.py:130` |
| POST | `/api/v1/simulations/{simulation_id}/health/refresh` | `backend/routers/game_mechanics.py:145` |
| POST | `/api/v1/simulations/{simulation_id}/generate/agent` | `backend/routers/generation.py:134` |
| POST | `/api/v1/simulations/{simulation_id}/generate/building` | `backend/routers/generation.py:170` |
| POST | `/api/v1/simulations/{simulation_id}/generate/portrait-description` | `backend/routers/generation.py:207` |
| POST | `/api/v1/simulations/{simulation_id}/generate/event` | `backend/routers/generation.py:241` |
| POST | `/api/v1/simulations/{simulation_id}/generate/relationships` | `backend/routers/generation.py:280` |
| POST | `/api/v1/simulations/{simulation_id}/generate/lore-image` | `backend/routers/generation.py:325` |
| POST | `/api/v1/simulations/{simulation_id}/generate/image` | `backend/routers/generation.py:362` |
| GET | `/api/v1/health` | `backend/routers/health.py:13` |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat` | `backend/routers/heartbeat.py:54` |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat/briefing` | `backend/routers/heartbeat.py:65` |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat/entries` | `backend/routers/heartbeat.py:76` |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat/arcs` | `backend/routers/heartbeat.py:98` |
| GET | `/api/v1/public/simulations/{simulation_id}/heartbeat/entries` | `backend/routers/heartbeat.py:123` |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/responses` | `backend/routers/heartbeat.py:147` |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/responses` | `backend/routers/heartbeat.py:168` |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}/responses/{response_id}` | `backend/routers/heartbeat.py:198` |
| GET | `/api/v1/simulations/{simulation_id}/attunements` | `backend/routers/heartbeat.py:227` |
| POST | `/api/v1/simulations/{simulation_id}/attunements` | `backend/routers/heartbeat.py:239` |
| DELETE | `/api/v1/simulations/{simulation_id}/attunements/{signature}` | `backend/routers/heartbeat.py:266` |
| GET | `/api/v1/anchors` | `backend/routers/heartbeat.py:293` |
| POST | `/api/v1/anchors` | `backend/routers/heartbeat.py:313` |
| POST | `/api/v1/anchors/{anchor_id}/join` | `backend/routers/heartbeat.py:342` |
| POST | `/api/v1/anchors/{anchor_id}/leave` | `backend/routers/heartbeat.py:364` |
| GET | `/api/v1/admin/heartbeat/dashboard` | `backend/routers/heartbeat.py:391` |
| GET | `/api/v1/admin/heartbeat/cascade-rules` | `backend/routers/heartbeat.py:401` |
| POST | `/api/v1/admin/heartbeat/force-tick/{simulation_id}` | `backend/routers/heartbeat.py:411` |
| GET | `/api/v1/admin/instagram/queue` | `backend/routers/instagram.py:62` |
| GET | `/api/v1/admin/instagram/queue/{post_id}` | `backend/routers/instagram.py:80` |
| POST | `/api/v1/admin/instagram/generate` | `backend/routers/instagram.py:94` |
| GET | `/api/v1/admin/instagram/candidates` | `backend/routers/instagram.py:136` |
| POST | `/api/v1/admin/instagram/queue` | `backend/routers/instagram.py:156` |
| POST | `/api/v1/admin/instagram/queue/{post_id}/approve` | `backend/routers/instagram.py:202` |
| POST | `/api/v1/admin/instagram/queue/{post_id}/reject` | `backend/routers/instagram.py:238` |
| POST | `/api/v1/admin/instagram/queue/{post_id}/publish` | `backend/routers/instagram.py:277` |
| GET | `/api/v1/admin/instagram/analytics` | `backend/routers/instagram.py:321` |
| GET | `/api/v1/admin/instagram/settings` | `backend/routers/instagram.py:335` |
| GET | `/api/v1/admin/instagram/rate-limit` | `backend/routers/instagram.py:348` |
| GET | `/api/v1/admin/instagram/status` | `backend/routers/instagram.py:369` |
| POST | `/api/v1/simulations/{simulation_id}/invitations` | `backend/routers/invitations.py:27` |
| GET | `/api/v1/simulations/{simulation_id}/invitations` | `backend/routers/invitations.py:59` |
| GET | `/api/v1/invitations/{token}` | `backend/routers/invitations.py:71` |
| POST | `/api/v1/invitations/{token}/accept` | `backend/routers/invitations.py:99` |
| GET | `/api/v1/journal/fragments` | `backend/routers/journal.py:84` |
| GET | `/api/v1/journal/fragments/{fragment_id}` | `backend/routers/journal.py:121` |
| GET | `/api/v1/journal/constellations` | `backend/routers/journal.py:162` |
| GET | `/api/v1/journal/constellations/{constellation_id}` | `backend/routers/journal.py:178` |
| POST | `/api/v1/journal/constellations` | `backend/routers/journal.py:190` |
| PATCH | `/api/v1/journal/constellations/{constellation_id}` | `backend/routers/journal.py:214` |
| POST | `/api/v1/journal/constellations/{constellation_id}/archive` | `backend/routers/journal.py:240` |
| POST | `/api/v1/journal/constellations/{constellation_id}/place` | `backend/routers/journal.py:258` |
| DELETE | `/api/v1/journal/constellations/{constellation_id}/fragments/{fragment_id}` | `backend/routers/journal.py:292` |
| POST | `/api/v1/journal/constellations/{constellation_id}/crystallize` | `backend/routers/journal.py:317` |
| GET | `/api/v1/journal/attunements` | `backend/routers/journal.py:372` |
| GET | `/api/v1/simulations/{simulation_id}/locations/cities` | `backend/routers/locations.py:44` |
| GET | `/api/v1/simulations/{simulation_id}/locations/cities/{city_id}` | `backend/routers/locations.py:58` |
| POST | `/api/v1/simulations/{simulation_id}/locations/cities` | `backend/routers/locations.py:71` |
| PUT | `/api/v1/simulations/{simulation_id}/locations/cities/{city_id}` | `backend/routers/locations.py:85` |
| GET | `/api/v1/simulations/{simulation_id}/locations/zones` | `backend/routers/locations.py:103` |
| GET | `/api/v1/simulations/{simulation_id}/locations/zones/{zone_id}` | `backend/routers/locations.py:118` |
| POST | `/api/v1/simulations/{simulation_id}/locations/zones` | `backend/routers/locations.py:131` |
| PUT | `/api/v1/simulations/{simulation_id}/locations/zones/{zone_id}` | `backend/routers/locations.py:145` |
| GET | `/api/v1/simulations/{simulation_id}/locations/streets` | `backend/routers/locations.py:163` |
| POST | `/api/v1/simulations/{simulation_id}/locations/streets` | `backend/routers/locations.py:186` |
| PUT | `/api/v1/simulations/{simulation_id}/locations/streets/{street_id}` | `backend/routers/locations.py:200` |
| GET | `/api/v1/simulations/{simulation_id}/members` | `backend/routers/members.py:24` |
| POST | `/api/v1/simulations/{simulation_id}/members` | `backend/routers/members.py:36` |
| PUT | `/api/v1/simulations/{simulation_id}/members/{member_id}` | `backend/routers/members.py:56` |
| DELETE | `/api/v1/simulations/{simulation_id}/members/{member_id}` | `backend/routers/members.py:78` |
| GET | `/api/v1/admin/news-scanner/dashboard` | `backend/routers/news_scanner.py:35` |
| GET | `/api/v1/admin/news-scanner/adapters` | `backend/routers/news_scanner.py:45` |
| PATCH | `/api/v1/admin/news-scanner/adapters/{name}` | `backend/routers/news_scanner.py:55` |
| POST | `/api/v1/admin/news-scanner/trigger-scan` | `backend/routers/news_scanner.py:78` |
| GET | `/api/v1/admin/news-scanner/candidates` | `backend/routers/news_scanner.py:101` |
| POST | `/api/v1/admin/news-scanner/candidates/{candidate_id}/approve` | `backend/routers/news_scanner.py:134` |
| POST | `/api/v1/admin/news-scanner/candidates/{candidate_id}/reject` | `backend/routers/news_scanner.py:163` |
| PATCH | `/api/v1/admin/news-scanner/candidates/{candidate_id}` | `backend/routers/news_scanner.py:184` |
| GET | `/api/v1/admin/news-scanner/scan-log` | `backend/routers/news_scanner.py:207` |
| POST | `/api/v1/epochs/{epoch_id}/operatives` | `backend/routers/operatives.py:34` |
| GET | `/api/v1/epochs/{epoch_id}/operatives` | `backend/routers/operatives.py:65` |
| GET | `/api/v1/epochs/{epoch_id}/operatives/threats` | `backend/routers/operatives.py:90` |
| POST | `/api/v1/epochs/{epoch_id}/operatives/resolve` | `backend/routers/operatives.py:105` |
| POST | `/api/v1/epochs/{epoch_id}/operatives/fortify-zone` | `backend/routers/operatives.py:133` |
| POST | `/api/v1/epochs/{epoch_id}/operatives/counter-intel` | `backend/routers/operatives.py:163` |
| GET | `/api/v1/epochs/{epoch_id}/operatives/{mission_id}` | `backend/routers/operatives.py:192` |
| POST | `/api/v1/epochs/{epoch_id}/operatives/{mission_id}/recall` | `backend/routers/operatives.py:207` |
| GET | `/api/v1/simulations/{simulation_id}/prompt-templates` | `backend/routers/prompt_templates.py:32` |
| GET | `/api/v1/simulations/{simulation_id}/prompt-templates/{template_id}` | `backend/routers/prompt_templates.py:58` |
| POST | `/api/v1/simulations/{simulation_id}/prompt-templates` | `backend/routers/prompt_templates.py:71` |
| PUT | `/api/v1/simulations/{simulation_id}/prompt-templates/{template_id}` | `backend/routers/prompt_templates.py:85` |
| DELETE | `/api/v1/simulations/{simulation_id}/prompt-templates/{template_id}` | `backend/routers/prompt_templates.py:100` |
| POST | `/api/v1/simulations/{simulation_id}/prompt-templates/test` | `backend/routers/prompt_templates.py:114` |
| GET | `/api/v1/public/platform-stats` | `backend/routers/public.py:118` |
| GET | `/api/v1/public/simulations` | `backend/routers/public.py:136` |
| GET | `/api/v1/public/simulations/by-slug/{slug}/forge-progress` | `backend/routers/public.py:158` |
| GET | `/api/v1/public/simulations/{simulation_id}` | `backend/routers/public.py:174` |
| GET | `/api/v1/public/simulations/{simulation_id}/bleed-status` | `backend/routers/public.py:191` |
| GET | `/api/v1/public/simulations/{simulation_id}/agents` | `backend/routers/public.py:208` |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/by-slug/{slug}` | `backend/routers/public.py:223` |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}` | `backend/routers/public.py:233` |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings` | `backend/routers/public.py:246` |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings/by-slug/{slug}` | `backend/routers/public.py:261` |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings/{building_id}` | `backend/routers/public.py:271` |
| GET | `/api/v1/public/simulations/{simulation_id}/events` | `backend/routers/public.py:284` |
| GET | `/api/v1/public/simulations/{simulation_id}/events/{event_id}` | `backend/routers/public.py:299` |
| GET | `/api/v1/public/simulations/{simulation_id}/anchor` | `backend/routers/public.py:312` |
| GET | `/api/v1/public/simulations/{simulation_id}/lore/by-slug/{slug}` | `backend/routers/public.py:326` |
| GET | `/api/v1/public/simulations/{simulation_id}/lore` | `backend/routers/public.py:338` |
| GET | `/api/v1/public/chronicles` | `backend/routers/public.py:351` |
| GET | `/api/v1/public/simulations/{simulation_id}/chronicles` | `backend/routers/public.py:367` |
| GET | `/api/v1/public/simulations/{simulation_id}/chronicles/{chronicle_id}` | `backend/routers/public.py:381` |
| GET | `/api/v1/public/simulations/{simulation_id}/broadsheets` | `backend/routers/public.py:394` |
| GET | `/api/v1/public/simulations/{simulation_id}/broadsheets/latest` | `backend/routers/public.py:408` |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}/memories` | `backend/routers/public.py:423` |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/cities` | `backend/routers/public.py:444` |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/cities/{city_id}` | `backend/routers/public.py:454` |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/zones` | `backend/routers/public.py:464` |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/zones/{zone_id}` | `backend/routers/public.py:474` |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/streets` | `backend/routers/public.py:484` |
| GET | `/api/v1/public/simulations/{simulation_id}/chat/conversations` | `backend/routers/public.py:499` |
| GET | `/api/v1/public/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages` | `backend/routers/public.py:509` |
| GET | `/api/v1/public/simulations/{simulation_id}/taxonomies` | `backend/routers/public.py:527` |
| GET | `/api/v1/public/simulations/{simulation_id}/settings` | `backend/routers/public.py:550` |
| GET | `/api/v1/public/simulations/{simulation_id}/social-trends` | `backend/routers/public.py:568` |
| GET | `/api/v1/public/simulations/{simulation_id}/social-media` | `backend/routers/public.py:582` |
| GET | `/api/v1/public/simulations/{simulation_id}/campaigns` | `backend/routers/public.py:599` |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}/relationships` | `backend/routers/public.py:616` |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}/aptitudes` | `backend/routers/public.py:626` |
| GET | `/api/v1/public/simulations/{simulation_id}/aptitudes` | `backend/routers/public.py:636` |
| GET | `/api/v1/public/simulations/{simulation_id}/relationships` | `backend/routers/public.py:646` |
| GET | `/api/v1/public/simulations/{simulation_id}/echoes` | `backend/routers/public.py:663` |
| GET | `/api/v1/public/simulations/{simulation_id}/events/{event_id}/echoes` | `backend/routers/public.py:679` |
| GET | `/api/v1/public/connections` | `backend/routers/public.py:692` |
| GET | `/api/v1/public/map-data` | `backend/routers/public.py:704` |
| GET | `/api/v1/public/battle-feed` | `backend/routers/public.py:719` |
| GET | `/api/v1/public/bleed-gazette` | `backend/routers/public.py:737` |
| GET | `/api/v1/public/simulations/{simulation_id}/embassies` | `backend/routers/public.py:755` |
| GET | `/api/v1/public/simulations/{simulation_id}/embassies/{embassy_id}` | `backend/routers/public.py:771` |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings/{building_id}/embassy` | `backend/routers/public.py:781` |
| GET | `/api/v1/public/embassies` | `backend/routers/public.py:791` |
| GET | `/api/v1/public/simulations/{simulation_id}/health` | `backend/routers/public.py:804` |
| GET | `/api/v1/public/simulations/{simulation_id}/health/buildings` | `backend/routers/public.py:814` |
| GET | `/api/v1/public/simulations/{simulation_id}/health/zones` | `backend/routers/public.py:833` |
| GET | `/api/v1/public/simulations/{simulation_id}/health/embassies` | `backend/routers/public.py:843` |
| GET | `/api/v1/public/health/all` | `backend/routers/public.py:853` |
| GET | `/api/v1/public/epochs` | `backend/routers/public.py:866` |
| GET | `/api/v1/public/epochs/active` | `backend/routers/public.py:880` |
| GET | `/api/v1/public/epochs/{epoch_id}` | `backend/routers/public.py:890` |
| GET | `/api/v1/public/epochs/{epoch_id}/participants` | `backend/routers/public.py:900` |
| GET | `/api/v1/public/epochs/{epoch_id}/teams` | `backend/routers/public.py:911` |
| GET | `/api/v1/public/epochs/{epoch_id}/leaderboard` | `backend/routers/public.py:924` |
| GET | `/api/v1/public/epochs/{epoch_id}/standings` | `backend/routers/public.py:938` |
| GET | `/api/v1/public/epochs/{epoch_id}/results-summary` | `backend/routers/public.py:951` |
| GET | `/api/v1/public/epochs/{epoch_id}/battle-log` | `backend/routers/public.py:973` |
| GET | `/api/v1/public/resonances` | `backend/routers/public.py:991` |
| GET | `/api/v1/public/resonances/{resonance_id}` | `backend/routers/public.py:1011` |
| GET | `/api/v1/public/resonances/{resonance_id}/impacts` | `backend/routers/public.py:1021` |
| GET | `/api/v1/public/operative-types` | `backend/routers/public.py:1034` |
| GET | `/api/v1/public/epoch-invitations/{token}` | `backend/routers/public.py:1056` |
| GET | `/api/v1/public/simulations/{simulation_id}/dungeons/history` | `backend/routers/public.py:1074` |
| GET | `/api/v1/public/dungeons/runs/{run_id}` | `backend/routers/public.py:1088` |
| GET | `/api/v1/public/dungeons/clearance-config` | `backend/routers/public.py:1098` |
| GET | `/api/v1/public/alpha-state` | `backend/routers/public.py:1117` |
| GET | `/api/v1/public/drift/state` | `backend/routers/public.py:1139` |
| GET | `/api/v1/public/drift/chart` | `backend/routers/public.py:1155` |
| GET | `/api/v1/public/bonds` | `backend/routers/public.py:1182` |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/relationships` | `backend/routers/relationships.py:29` |
| GET | `/api/v1/simulations/{simulation_id}/relationships` | `backend/routers/relationships.py:42` |
| POST | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/relationships` | `backend/routers/relationships.py:56` |
| PATCH | `/api/v1/simulations/{simulation_id}/relationships/{relationship_id}` | `backend/routers/relationships.py:76` |
| DELETE | `/api/v1/simulations/{simulation_id}/relationships/{relationship_id}` | `backend/routers/relationships.py:93` |
| GET | `/api/v1/dungeons/available` | `backend/routers/resonance_dungeons.py:72` |
| POST | `/api/v1/dungeons/runs` | `backend/routers/resonance_dungeons.py:87` |
| GET | `/api/v1/dungeons/runs/{run_id}` | `backend/routers/resonance_dungeons.py:115` |
| GET | `/api/v1/dungeons/runs/{run_id}/state` | `backend/routers/resonance_dungeons.py:129` |
| POST | `/api/v1/dungeons/runs/{run_id}/move` | `backend/routers/resonance_dungeons.py:146` |
| POST | `/api/v1/dungeons/runs/{run_id}/action` | `backend/routers/resonance_dungeons.py:163` |
| POST | `/api/v1/dungeons/runs/{run_id}/combat/submit` | `backend/routers/resonance_dungeons.py:180` |
| POST | `/api/v1/dungeons/runs/{run_id}/scout` | `backend/routers/resonance_dungeons.py:197` |
| POST | `/api/v1/dungeons/runs/{run_id}/seal` | `backend/routers/resonance_dungeons.py:214` |
| POST | `/api/v1/dungeons/runs/{run_id}/ground` | `backend/routers/resonance_dungeons.py:231` |
| POST | `/api/v1/dungeons/runs/{run_id}/rally` | `backend/routers/resonance_dungeons.py:248` |
| POST | `/api/v1/dungeons/runs/{run_id}/salvage` | `backend/routers/resonance_dungeons.py:265` |
| POST | `/api/v1/dungeons/runs/{run_id}/rest` | `backend/routers/resonance_dungeons.py:282` |
| POST | `/api/v1/dungeons/runs/{run_id}/retreat` | `backend/routers/resonance_dungeons.py:299` |
| POST | `/api/v1/dungeons/runs/{run_id}/distribute` | `backend/routers/resonance_dungeons.py:324` |
| POST | `/api/v1/dungeons/runs/{run_id}/distribute/confirm` | `backend/routers/resonance_dungeons.py:354` |
| GET | `/api/v1/dungeons/runs/{run_id}/events` | `backend/routers/resonance_dungeons.py:379` |
| GET | `/api/v1/dungeons/history` | `backend/routers/resonance_dungeons.py:406` |
| GET | `/api/v1/dungeons/agents/{agent_id}/loot-effects` | `backend/routers/resonance_dungeons.py:428` |
| GET | `/api/v1/resonances` | `backend/routers/resonances.py:45` |
| GET | `/api/v1/resonances/{resonance_id}` | `backend/routers/resonances.py:72` |
| POST | `/api/v1/resonances` | `backend/routers/resonances.py:86` |
| PUT | `/api/v1/resonances/{resonance_id}` | `backend/routers/resonances.py:113` |
| POST | `/api/v1/resonances/{resonance_id}/process-impact` | `backend/routers/resonances.py:141` |
| GET | `/api/v1/resonances/{resonance_id}/impacts` | `backend/routers/resonances.py:183` |
| PUT | `/api/v1/resonances/{resonance_id}/status` | `backend/routers/resonances.py:197` |
| POST | `/api/v1/resonances/{resonance_id}/restore` | `backend/routers/resonances.py:221` |
| DELETE | `/api/v1/resonances/{resonance_id}` | `backend/routers/resonances.py:244` |
| GET | `/api/v1/epochs/{epoch_id}/scores/leaderboard` | `backend/routers/scores.py:25` |
| GET | `/api/v1/epochs/{epoch_id}/scores/standings` | `backend/routers/scores.py:38` |
| GET | `/api/v1/epochs/{epoch_id}/scores/simulations/{simulation_id}` | `backend/routers/scores.py:53` |
| GET | `/api/v1/epochs/{epoch_id}/scores/intel-dossiers` | `backend/routers/scores.py:68` |
| POST | `/api/v1/epochs/{epoch_id}/scores/compute` | `backend/routers/scores.py:84` |
| GET | `/robots.txt` | `backend/routers/seo.py:51` |
| GET | `/sitemap.xml` | `backend/routers/seo.py:56` |
| GET | `/{settings.indexnow_key}.txt` | `backend/routers/seo.py:195` |
| GET | `/api/v1/simulations/{simulation_id}/settings` | `backend/routers/settings.py:26` |
| GET | `/api/v1/simulations/{simulation_id}/settings/by-category/{category}` | `backend/routers/settings.py:39` |
| GET | `/api/v1/simulations/{simulation_id}/settings/{setting_id}` | `backend/routers/settings.py:52` |
| POST | `/api/v1/simulations/{simulation_id}/settings` | `backend/routers/settings.py:65` |
| PUT | `/api/v1/simulations/{simulation_id}/settings/{setting_id}` | `backend/routers/settings.py:92` |
| DELETE | `/api/v1/simulations/{simulation_id}/settings/{setting_id}` | `backend/routers/settings.py:126` |
| GET | `/api/v1/simulations` | `backend/routers/simulations.py:42` |
| POST | `/api/v1/simulations` | `backend/routers/simulations.py:62` |
| GET | `/api/v1/simulations/{simulation_id}` | `backend/routers/simulations.py:87` |
| PUT | `/api/v1/simulations/{simulation_id}` | `backend/routers/simulations.py:105` |
| DELETE | `/api/v1/simulations/{simulation_id}` | `backend/routers/simulations.py:131` |
| POST | `/api/v1/simulations/{simulation_id}/threshold-actions/{action_type}` | `backend/routers/simulations.py:161` |
| POST | `/api/v1/simulations/{simulation_id}/lore` | `backend/routers/simulations.py:189` |
| PATCH | `/api/v1/simulations/{simulation_id}/lore/{section_id}` | `backend/routers/simulations.py:211` |
| DELETE | `/api/v1/simulations/{simulation_id}/lore/{section_id}` | `backend/routers/simulations.py:235` |
| PUT | `/api/v1/simulations/{simulation_id}/lore` | `backend/routers/simulations.py:256` |
| GET | `/api/v1/simulations/{simulation_id}/social-media/posts` | `backend/routers/social_media.py:41` |
| POST | `/api/v1/simulations/{simulation_id}/social-media/sync` | `backend/routers/social_media.py:64` |
| POST | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/transform` | `backend/routers/social_media.py:122` |
| POST | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/analyze-sentiment` | `backend/routers/social_media.py:174` |
| POST | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/generate-reactions` | `backend/routers/social_media.py:222` |
| GET | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/comments` | `backend/routers/social_media.py:310` |
| GET | `/api/v1/admin/instagram/stories` | `backend/routers/social_stories.py:60` |
| GET | `/api/v1/admin/instagram/stories/sequence/{resonance_id}` | `backend/routers/social_stories.py:80` |
| GET | `/api/v1/admin/instagram/stories/{story_id}` | `backend/routers/social_stories.py:109` |
| POST | `/api/v1/admin/instagram/stories/{story_id}/skip` | `backend/routers/social_stories.py:128` |
| POST | `/api/v1/admin/instagram/stories/{story_id}/unskip` | `backend/routers/social_stories.py:161` |
| POST | `/api/v1/admin/instagram/stories/{story_id}/compose` | `backend/routers/social_stories.py:190` |
| POST | `/api/v1/admin/instagram/stories/{story_id}/publish` | `backend/routers/social_stories.py:225` |
| POST | `/api/v1/admin/instagram/stories/{story_id}/regenerate` | `backend/routers/social_stories.py:260` |
| GET | `/api/v1/admin/instagram/stories/settings` | `backend/routers/social_stories.py:303` |
| GET | `/api/v1/simulations/{simulation_id}/social-trends` | `backend/routers/social_trends.py:79` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/fetch` | `backend/routers/social_trends.py:104` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/transform` | `backend/routers/social_trends.py:142` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/integrate` | `backend/routers/social_trends.py:184` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/workflow` | `backend/routers/social_trends.py:242` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/browse` | `backend/routers/social_trends.py:292` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/transform-article` | `backend/routers/social_trends.py:329` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/integrate-article` | `backend/routers/social_trends.py:368` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/batch-transform` | `backend/routers/social_trends.py:451` |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/batch-integrate` | `backend/routers/social_trends.py:506` |
| POST | `/api/v1/simulations/{simulation_id}/style-references/upload` | `backend/routers/style_references.py:28` |
| GET | `/api/v1/simulations/{simulation_id}/style-references/{entity_type}` | `backend/routers/style_references.py:106` |
| DELETE | `/api/v1/simulations/{simulation_id}/style-references/{entity_type}` | `backend/routers/style_references.py:129` |
| GET | `/api/v1/simulations/{simulation_id}/taxonomies` | `backend/routers/taxonomies.py:23` |
| GET | `/api/v1/simulations/{simulation_id}/taxonomies/by-type/{taxonomy_type}` | `backend/routers/taxonomies.py:42` |
| POST | `/api/v1/simulations/{simulation_id}/taxonomies` | `backend/routers/taxonomies.py:55` |
| PUT | `/api/v1/simulations/{simulation_id}/taxonomies/{taxonomy_id}` | `backend/routers/taxonomies.py:77` |
| DELETE | `/api/v1/simulations/{simulation_id}/taxonomies/{taxonomy_id}` | `backend/routers/taxonomies.py:104` |
| GET | `/api/v1/users/me/dashboard` | `backend/routers/users.py:21` |
| GET | `/api/v1/users/me` | `backend/routers/users.py:32` |
| GET | `/api/v1/users/me/notification-preferences` | `backend/routers/users.py:67` |
| POST | `/api/v1/users/me/notification-preferences` | `backend/routers/users.py:80` |
| PATCH | `/api/v1/users/me/onboarding` | `backend/routers/users.py:99` |
| POST | `/api/v1/webhooks/github` | `backend/routers/webhooks.py:61` |
| GET | `/api/v1/public/simulations/{simulation_id}/map` | `backend/routers/world_map.py:63` |
| POST | `/api/v1/admin/simulations/{simulation_id}/map/regenerate` | `backend/routers/world_map.py:89` |
| GET | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions` | `backend/routers/zone_actions.py:24` |
| POST | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions` | `backend/routers/zone_actions.py:37` |
| DELETE | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions/{action_id}` | `backend/routers/zone_actions.py:66` |

## Task 2 — Frontend Caller Map

For each backend endpoint: the api-service method that calls it (file:line), the component(s) that call that method (file:line; grep across all of `frontend/src`, not only `components/`, since some call sites live in `utils/` or `services/chat/`), and ORPHAN-BACKEND classification where no frontend caller exists. 'Component callers' blank = the api-service method exists and its path matches, but no component (or util/service) anywhere calls that method — a client that is wired but never invoked.

| Method | Path | API-service method (file:line) | Component caller(s) | Note |
|---|---|---|---|---|
| GET | `/api/v1/achievements/definitions` | `frontend/src/services/api/AchievementsApiService.ts:45` `AchievementsApiService.getDefinitions` | `frontend/src/components/platform/VelgAchievementGrid.ts:190`<br>`frontend/src/components/platform/VelgAchievementToast.ts:111` |  |
| GET | `/api/v1/admin/ai-usage/stats` | `frontend/src/services/api/AdminApiService.ts:76` `AdminApiService.getAIUsageStats` | `frontend/src/components/admin/AdminAIUsageTab.ts:105` |  |
| GET | `/api/v1/admin/bluesky/analytics` | `frontend/src/services/api/AdminApiService.ts:293` `AdminApiService.getBlueskyAnalytics` | `frontend/src/components/admin/AdminBlueskyTab.ts:316` |  |
| GET | `/api/v1/admin/bluesky/queue` | `frontend/src/services/api/AdminApiService.ts:273` `AdminApiService.listBlueskyQueue` | `frontend/src/components/admin/AdminBlueskyTab.ts:315` |  |
| GET | `/api/v1/admin/bluesky/queue/{post_id}` | `frontend/src/services/api/AdminApiService.ts:277` `AdminApiService.getBlueskyPost` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/admin/bluesky/queue/{post_id}/publish` | `frontend/src/services/api/AdminApiService.ts:289` `AdminApiService.forcePublishBlueskyPost` | `frontend/src/components/admin/AdminBlueskyTab.ts:407` |  |
| POST | `/api/v1/admin/bluesky/queue/{post_id}/skip` | `frontend/src/services/api/AdminApiService.ts:281` `AdminApiService.skipBlueskyPost` | `frontend/src/components/admin/AdminBlueskyTab.ts:364` |  |
| POST | `/api/v1/admin/bluesky/queue/{post_id}/unskip` | `frontend/src/services/api/AdminApiService.ts:285` `AdminApiService.unskipBlueskyPost` | `frontend/src/components/admin/AdminBlueskyTab.ts:382` |  |
| GET | `/api/v1/admin/bluesky/settings` | `frontend/src/services/api/AdminApiService.ts:297` `AdminApiService.getBlueskySettings` | `frontend/src/components/admin/AdminBlueskyTab.ts:318`<br>`frontend/src/components/admin/AdminBlueskyTab.ts:464` |  |
| GET | `/api/v1/admin/bluesky/status` | `frontend/src/services/api/AdminApiService.ts:301` `AdminApiService.getBlueskyStatus` | `frontend/src/components/admin/AdminBlueskyTab.ts:317`<br>`frontend/src/components/admin/AdminBlueskyTab.ts:425` |  |
| POST | `/api/v1/admin/cleanup/execute` | `frontend/src/services/api/AdminApiService.ts:96` `AdminApiService.executeCleanup` | `frontend/src/components/admin/AdminCleanupTab.ts:484` |  |
| POST | `/api/v1/admin/cleanup/preview` | `frontend/src/services/api/AdminApiService.ts:84` `AdminApiService.previewCleanup` | `frontend/src/components/admin/AdminCleanupTab.ts:456`<br>`frontend/src/components/admin/AdminCleanupTab.ts:587` |  |
| GET | `/api/v1/admin/cleanup/stats` | `frontend/src/services/api/AdminApiService.ts:72` `AdminApiService.getCleanupStats` | `frontend/src/components/admin/AdminCleanupTab.ts:446` |  |
| GET | `/api/v1/admin/content-drafts` | `frontend/src/services/api/ContentDraftsApiService.ts:169` `ContentDraftsApiService.listDrafts` | `frontend/src/components/admin/content-drafts/VelgContentDraftsList.ts:446` |  |
| POST | `/api/v1/admin/content-drafts` | `frontend/src/services/api/ContentDraftsApiService.ts:208` `ContentDraftsApiService.createDraft` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:1005` |  |
| GET | `/api/v1/admin/content-drafts/by-pr/{pr_number}` | `frontend/src/services/api/ContentDraftsApiService.ts:187` `ContentDraftsApiService.listByPr` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/content-drafts/open-for-resource` | `frontend/src/services/api/ContentDraftsApiService.ts:195` `ContentDraftsApiService.listOpenForResource` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:714` |  |
| POST | `/api/v1/admin/content-drafts/orphan-sweeper/run-now` | `frontend/src/services/api/ContentDraftsApiService.ts:288` `ContentDraftsApiService.runOrphanSweeperNow` | `frontend/src/components/admin/content-drafts/VelgOrphanSweeperSettingsModal.ts:35`<br>`frontend/src/components/admin/content-drafts/VelgOrphanSweeperSettingsModal.ts:438` |  |
| POST | `/api/v1/admin/content-drafts/publish` | `frontend/src/services/api/ContentDraftsApiService.ts:236` `ContentDraftsApiService.publishBatch` | `frontend/src/components/admin/content-drafts/VelgPublishBatchModal.ts:213` |  |
| POST | `/api/v1/admin/content-drafts/sweep-orphans` | `frontend/src/services/api/ContentDraftsApiService.ts:275` `ContentDraftsApiService.sweepOrphans` | `frontend/src/components/admin/content-drafts/VelgSweepOrphansModal.ts:263` |  |
| DELETE | `/api/v1/admin/content-drafts/{draft_id}` | `frontend/src/services/api/ContentDraftsApiService.ts:231` `ContentDraftsApiService.abandonDraft` | `frontend/src/components/admin/content-drafts/VelgContentDraftsList.ts:541` |  |
| GET | `/api/v1/admin/content-drafts/{draft_id}` | `frontend/src/services/api/ContentDraftsApiService.ts:203` `ContentDraftsApiService.getDraft` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:595` |  |
| PATCH | `/api/v1/admin/content-drafts/{draft_id}` | `frontend/src/services/api/ContentDraftsApiService.ts:221` `ContentDraftsApiService.updateWorking` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:888` |  |
| GET | `/api/v1/admin/content-drafts/{draft_id}/conflict-preview` | `frontend/src/services/api/ContentDraftsApiService.ts:250` `ContentDraftsApiService.getConflictPreview` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:636` |  |
| POST | `/api/v1/admin/content-drafts/{draft_id}/resolve` | `frontend/src/services/api/ContentDraftsApiService.ts:261` `ContentDraftsApiService.resolveConflict` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:663` |  |
| GET | `/api/v1/admin/content-packs` | `frontend/src/services/api/ContentPacksApiService.ts:39` `ContentPacksApiService.listManifest` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:543` |  |
| GET | `/api/v1/admin/content-packs/{pack_slug}/{resource_path}` | `frontend/src/services/api/ContentPacksApiService.ts:48` `ContentPacksApiService.getResource` | `frontend/src/components/admin/content-drafts/VelgContentDraftEditor.ts:994` |  |
| GET | `/api/v1/admin/dungeon-config/global` | `frontend/src/services/api/AdminApiService.ts:372` `AdminApiService.getDungeonGlobalConfig` | `frontend/src/components/admin/AdminDungeonsTab.ts:541` |  |
| PUT | `/api/v1/admin/dungeon-config/global` | `frontend/src/services/api/AdminApiService.ts:378` `AdminApiService.updateDungeonGlobalConfig` | `frontend/src/components/admin/AdminDungeonsTab.ts:618` |  |
| POST | `/api/v1/admin/dungeon-content/reload-cache` | `frontend/src/services/api/DungeonContentAdminApi.ts:67` `DungeonContentAdminApi.reloadCache` | `frontend/src/components/admin/AdminDungeonContentTab.ts:317` |  |
| GET | `/api/v1/admin/dungeon-content/{content_type}` | `frontend/src/services/api/DungeonContentAdminApi.ts:34` `DungeonContentAdminApi.listContent` | `frontend/src/components/admin/AdminDungeonContentTab.ts:223` |  |
| POST | `/api/v1/admin/dungeon-content/{content_type}` | `frontend/src/services/api/DungeonContentAdminApi.ts:56` `DungeonContentAdminApi.createItem` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/admin/dungeon-content/{content_type}/{item_id}` | `frontend/src/services/api/DungeonContentAdminApi.ts:63` `DungeonContentAdminApi.deleteItem` | `frontend/src/components/admin/AdminDungeonContentTab.ts:303` |  |
| GET | `/api/v1/admin/dungeon-content/{content_type}/{item_id}` | `frontend/src/services/api/DungeonContentAdminApi.ts:41` `DungeonContentAdminApi.getItem` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/admin/dungeon-content/{content_type}/{item_id}` | `frontend/src/services/api/DungeonContentAdminApi.ts:49` `DungeonContentAdminApi.updateItem` | `frontend/src/components/admin/AdminDungeonContentTab.ts:286` |  |
| GET | `/api/v1/admin/dungeon-override` | `frontend/src/services/api/AdminApiService.ts:389` `AdminApiService.listDungeonOverrides` | `frontend/src/components/admin/AdminDungeonsTab.ts:542` |  |
| GET | `/api/v1/admin/dungeon-override/simulations/{simulation_id}` | `frontend/src/services/api/AdminApiService.ts:393` `AdminApiService.getDungeonOverride` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/admin/dungeon-override/simulations/{simulation_id}` | `frontend/src/services/api/AdminApiService.ts:400` `AdminApiService.updateDungeonOverride` | `frontend/src/components/admin/AdminDungeonsTab.ts:673` |  |
| GET | `/api/v1/admin/environment` | `frontend/src/services/api/AdminApiService.ts:15` `AdminApiService.getEnvironment` | `frontend/src/components/admin/AdminModelsTab.ts:547` |  |
| GET | `/api/v1/admin/health-effects` | `frontend/src/services/api/AdminApiService.ts:183` `AdminApiService.getHealthEffects` | `frontend/src/components/admin/AdminHealthTab.ts:260` |  |
| PUT | `/api/v1/admin/health-effects/simulations/{simulation_id}` | `frontend/src/services/api/AdminApiService.ts:190` `AdminApiService.updateSimulationHealthEffects` | `frontend/src/components/admin/AdminHealthTab.ts:293` |  |
| GET | `/api/v1/admin/heartbeat/cascade-rules` | `frontend/src/services/api/HeartbeatApiService.ts:122` `HeartbeatApiService.listCascadeRules` | `frontend/src/components/admin/AdminHeartbeatTab.ts:748` |  |
| GET | `/api/v1/admin/heartbeat/dashboard` | `frontend/src/services/api/HeartbeatApiService.ts:118` `HeartbeatApiService.getDashboard` | `frontend/src/components/admin/AdminHeartbeatTab.ts:708`<br>`frontend/src/components/admin/AdminHeartbeatTab.ts:730` |  |
| POST | `/api/v1/admin/heartbeat/force-tick/{simulation_id}` | `frontend/src/services/api/HeartbeatApiService.ts:126` `HeartbeatApiService.forceTick` | `frontend/src/components/admin/AdminHeartbeatTab.ts:887` |  |
| POST | `/api/v1/admin/impersonate` | `frontend/src/services/api/AdminApiService.ts:177` `AdminApiService.impersonateUser` | `frontend/src/components/platform/DevAccountSwitcher.ts:613` |  |
| GET | `/api/v1/admin/instagram/analytics` | `frontend/src/services/api/AdminApiService.ts:242` `AdminApiService.getInstagramAnalytics` | `frontend/src/components/admin/AdminInstagramTab.ts:1271` |  |
| GET | `/api/v1/admin/instagram/candidates` | `frontend/src/services/api/AdminApiService.ts:214` `AdminApiService.listInstagramCandidates` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/instagram/ciphers` | `frontend/src/services/api/AdminApiService.ts:250` `AdminApiService.getInstagramCipherStats` | `frontend/src/components/admin/AdminInstagramTab.ts:1273` |  |
| POST | `/api/v1/admin/instagram/generate` | `frontend/src/services/api/AdminApiService.ts:210` `AdminApiService.generateInstagramContent` | `frontend/src/components/admin/AdminInstagramTab.ts:1461` |  |
| GET | `/api/v1/admin/instagram/queue` | `frontend/src/services/api/AdminApiService.ts:198` `AdminApiService.listInstagramQueue` | `frontend/src/components/admin/AdminInstagramTab.ts:1270` |  |
| POST | `/api/v1/admin/instagram/queue` | `frontend/src/services/api/AdminApiService.ts:220` `AdminApiService.createInstagramPost` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/instagram/queue/{post_id}` | `frontend/src/services/api/AdminApiService.ts:202` `AdminApiService.getInstagramPost` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/admin/instagram/queue/{post_id}/approve` | `frontend/src/services/api/AdminApiService.ts:227` `AdminApiService.approveInstagramPost` | `frontend/src/components/admin/AdminInstagramTab.ts:1479` |  |
| POST | `/api/v1/admin/instagram/queue/{post_id}/publish` | `frontend/src/services/api/AdminApiService.ts:238` `AdminApiService.forcePublishInstagramPost` | `frontend/src/components/admin/AdminInstagramTab.ts:1541` |  |
| POST | `/api/v1/admin/instagram/queue/{post_id}/reject` | `frontend/src/services/api/AdminApiService.ts:234` `AdminApiService.rejectInstagramPost` | `frontend/src/components/admin/AdminInstagramTab.ts:1509` |  |
| GET | `/api/v1/admin/instagram/rate-limit` | `frontend/src/services/api/AdminApiService.ts:246` `AdminApiService.getInstagramRateLimit` | `frontend/src/components/admin/AdminInstagramTab.ts:1272` |  |
| GET | `/api/v1/admin/instagram/settings` | `frontend/src/services/api/AdminApiService.ts:261` `AdminApiService.getInstagramSettings` | `frontend/src/components/admin/AdminInstagramTab.ts:1274` |  |
| GET | `/api/v1/admin/instagram/status` | `frontend/src/services/api/AdminApiService.ts:265` `AdminApiService.getInstagramStatus` | `frontend/src/components/admin/AdminInstagramTab.ts:1275`<br>`frontend/src/components/admin/AdminInstagramTab.ts:1435` |  |
| GET | `/api/v1/admin/instagram/stories` | `frontend/src/services/api/AdminApiService.ts:309` `AdminApiService.listSocialStories` | `frontend/src/components/admin/AdminInstagramTab.ts:1276` |  |
| GET | `/api/v1/admin/instagram/stories/sequence/{resonance_id}` | `frontend/src/services/api/AdminApiService.ts:313` `AdminApiService.getSocialStorySequence` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/instagram/stories/settings` | `frontend/src/services/api/AdminApiService.ts:333` `AdminApiService.getSocialStorySettings` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/admin/instagram/stories/{story_id}/compose` | `frontend/src/services/api/AdminApiService.ts:325` `AdminApiService.forceComposeSocialStory` | `frontend/src/components/admin/AdminInstagramTab.ts:2167` |  |
| POST | `/api/v1/admin/instagram/stories/{story_id}/publish` | `frontend/src/services/api/AdminApiService.ts:329` `AdminApiService.forcePublishSocialStory` | `frontend/src/components/admin/AdminInstagramTab.ts:2181` |  |
| POST | `/api/v1/admin/instagram/stories/{story_id}/skip` | `frontend/src/services/api/AdminApiService.ts:317` `AdminApiService.skipSocialStory` | `frontend/src/components/admin/AdminInstagramTab.ts:2139` |  |
| POST | `/api/v1/admin/instagram/stories/{story_id}/unskip` | `frontend/src/services/api/AdminApiService.ts:321` `AdminApiService.unskipSocialStory` | `frontend/src/components/admin/AdminInstagramTab.ts:2153` |  |
| POST | `/api/v1/admin/instagram/{post_id}/cipher` | `frontend/src/services/api/AdminApiService.ts:257` `AdminApiService.setInstagramCipher` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/news-scanner/adapters` | `frontend/src/services/api/ScannerApiService.ts:97` `ScannerApiService.listAdapters` | **NONE FOUND** | dead client — path matches, zero callers |
| PATCH | `/api/v1/admin/news-scanner/adapters/{name}` | `frontend/src/services/api/ScannerApiService.ts:101` `ScannerApiService.toggleAdapter` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/news-scanner/candidates` | `frontend/src/services/api/ScannerApiService.ts:112` `ScannerApiService.listCandidates` | `frontend/src/components/admin/AdminScannerTab.ts:1211` |  |
| PATCH | `/api/v1/admin/news-scanner/candidates/{candidate_id}` | `frontend/src/services/api/ScannerApiService.ts:132` `ScannerApiService.updateCandidate` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/admin/news-scanner/candidates/{candidate_id}/approve` | `frontend/src/services/api/ScannerApiService.ts:116` `ScannerApiService.approveCandidate` | `frontend/src/components/admin/AdminScannerTab.ts:1279` |  |
| POST | `/api/v1/admin/news-scanner/candidates/{candidate_id}/reject` | `frontend/src/services/api/ScannerApiService.ts:120` `ScannerApiService.rejectCandidate` | `frontend/src/components/admin/AdminScannerTab.ts:1305` |  |
| GET | `/api/v1/admin/news-scanner/dashboard` | `frontend/src/services/api/ScannerApiService.ts:93` `ScannerApiService.getDashboard` | `frontend/src/components/admin/AdminScannerTab.ts:1190` |  |
| GET | `/api/v1/admin/news-scanner/scan-log` | `frontend/src/services/api/ScannerApiService.ts:136` `ScannerApiService.getScanLog` | `frontend/src/components/admin/AdminScannerTab.ts:1232` |  |
| POST | `/api/v1/admin/news-scanner/trigger-scan` | `frontend/src/services/api/ScannerApiService.ts:105` `ScannerApiService.triggerScan` | `frontend/src/components/admin/AdminScannerTab.ts:1249` |  |
| GET | `/api/v1/admin/ops/audit` | `frontend/src/services/api/BureauOpsApiService.ts:243` `BureauOpsApiService.getAuditLog` | `frontend/src/components/admin/ops/DispatchTicker.ts:142`<br>`frontend/src/components/admin/ops/IncidentDossierDrawer.ts:241` |  |
| POST | `/api/v1/admin/ops/budget` | `frontend/src/services/api/BureauOpsApiService.ts:251` `BureauOpsApiService.createBudget` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/admin/ops/budget/{budget_id}` | `frontend/src/services/api/BureauOpsApiService.ts:259` `BureauOpsApiService.deleteBudget` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/admin/ops/budget/{budget_id}` | `frontend/src/services/api/BureauOpsApiService.ts:255` `BureauOpsApiService.updateBudget` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/ops/budgets` | `frontend/src/services/api/BureauOpsApiService.ts:247` `BureauOpsApiService.listBudgets` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/admin/ops/circuit` | `frontend/src/services/api/BureauOpsApiService.ts:239` `BureauOpsApiService.getCircuit` | `frontend/src/components/admin/AdminOpsTab.ts:288` |  |
| POST | `/api/v1/admin/ops/circuit/reset` | `frontend/src/services/api/BureauOpsApiService.ts:275` `BureauOpsApiService.resetCircuit` | `frontend/src/components/admin/ops/QuarantinePanel.ts:319` |  |
| GET | `/api/v1/admin/ops/firehose` | `frontend/src/services/api/BureauOpsApiService.ts:235` `BureauOpsApiService.getFirehose` | `frontend/src/components/admin/ops/FirehosePanel.ts:5`<br>`frontend/src/components/admin/ops/FirehosePanel.ts:151` |  |
| GET | `/api/v1/admin/ops/forecast` | `frontend/src/services/api/BureauOpsApiService.ts:286` `BureauOpsApiService.getForecast` | `frontend/src/components/admin/ops/ForecastPanel.ts:290` |  |
| GET | `/api/v1/admin/ops/heatmap` | `frontend/src/services/api/BureauOpsApiService.ts:282` `BureauOpsApiService.getHeatmap` | `frontend/src/components/admin/ops/HeatmapPanel.ts:193` |  |
| POST | `/api/v1/admin/ops/kill` | `frontend/src/services/api/BureauOpsApiService.ts:263` `BureauOpsApiService.tripKill` | `frontend/src/components/admin/ops/QuarantinePanel.ts:263` |  |
| POST | `/api/v1/admin/ops/kill/cut-all-ai` | `frontend/src/services/api/BureauOpsApiService.ts:271` `BureauOpsApiService.cutAllAI` | `frontend/src/components/admin/ops/QuarantinePanel.ts:352` |  |
| GET | `/api/v1/admin/ops/ledger` | `frontend/src/services/api/BureauOpsApiService.ts:231` `BureauOpsApiService.getLedger` | `frontend/src/components/admin/AdminOpsTab.ts:272` |  |
| POST | `/api/v1/admin/ops/revert` | `frontend/src/services/api/BureauOpsApiService.ts:267` `BureauOpsApiService.revertKill` | `frontend/src/components/admin/ops/QuarantinePanel.ts:286` |  |
| GET | `/api/v1/admin/ops/sentry/rules` | `frontend/src/services/api/BureauOpsApiService.ts:290` `BureauOpsApiService.listSentryRules` | `frontend/src/components/admin/ops/SentryRulesPanel.ts:417` |  |
| POST | `/api/v1/admin/ops/sentry/rules` | `frontend/src/services/api/BureauOpsApiService.ts:294` `BureauOpsApiService.createSentryRule` | `frontend/src/components/admin/ops/SentryRulesPanel.ts:470` |  |
| DELETE | `/api/v1/admin/ops/sentry/rules/{rule_id}` | `frontend/src/services/api/BureauOpsApiService.ts:302` `BureauOpsApiService.deleteSentryRule` | `frontend/src/components/admin/ops/SentryRulesPanel.ts:546` |  |
| PUT | `/api/v1/admin/ops/sentry/rules/{rule_id}` | `frontend/src/services/api/BureauOpsApiService.ts:298` `BureauOpsApiService.updateSentryRule` | `frontend/src/components/admin/ops/SentryRulesPanel.ts:469`<br>`frontend/src/components/admin/ops/SentryRulesPanel.ts:518` |  |
| GET | `/api/v1/admin/settings` | `frontend/src/services/api/AdminApiService.ts:19` `AdminApiService.listSettings` | `frontend/src/components/admin/content-drafts/VelgOrphanSweeperSettingsModal.ts:33`<br>`frontend/src/components/admin/content-drafts/VelgOrphanSweeperSettingsModal.ts:293`<br>`frontend/src/components/admin/AdminCachingTab.ts:171`<br>`frontend/src/components/admin/AdminModelsTab.ts:546`<br>`frontend/src/components/admin/AdminAnnouncementsTab.ts:185`<br>`frontend/src/components/admin/AdminApiKeysTab.ts:287`<br>(+2 more) |  |
| PUT | `/api/v1/admin/settings/{key}` | `frontend/src/services/api/AdminApiService.ts:23` `AdminApiService.updateSetting` | `frontend/src/components/admin/content-drafts/VelgOrphanSweeperSettingsModal.ts:34`<br>`frontend/src/components/admin/content-drafts/VelgOrphanSweeperSettingsModal.ts:360`<br>`frontend/src/components/admin/AdminBlueskyTab.ts:460`<br>`frontend/src/components/admin/AdminCachingTab.ts:207`<br>`frontend/src/components/admin/AdminModelsTab.ts:626`<br>`frontend/src/components/admin/AdminAnnouncementsTab.ts:199`<br>(+9 more) |  |
| GET | `/api/v1/admin/simulations` | `frontend/src/services/api/AdminApiService.ts:343` `AdminApiService.listSimulations` | `frontend/src/components/admin/AdminSimulationsTab.ts:329` |  |
| GET | `/api/v1/admin/simulations/deleted` | `frontend/src/services/api/AdminApiService.ts:351` `AdminApiService.listDeletedSimulations` | `frontend/src/components/admin/AdminSimulationsTab.ts:330` |  |
| DELETE | `/api/v1/admin/simulations/{simulation_id}` | `frontend/src/services/api/AdminApiService.ts:358` `AdminApiService.softDeleteSimulation` | `frontend/src/components/admin/AdminSimulationsTab.ts:380` |  |
| POST | `/api/v1/admin/simulations/{simulation_id}/map/regenerate` | `frontend/src/services/api/WorldMapApiService.ts:24` `WorldMapApiService.regenerate` | `frontend/src/components/world-map/SimulationWorldMap.ts:1445` |  |
| POST | `/api/v1/admin/simulations/{simulation_id}/restore` | `frontend/src/services/api/AdminApiService.ts:366` `AdminApiService.restoreSimulation` | `frontend/src/components/admin/AdminSimulationsTab.ts:426` |  |
| GET | `/api/v1/admin/users` | `frontend/src/services/api/AdminApiService.ts:30` `AdminApiService.listUsers` | `frontend/src/components/platform/DevAccountSwitcher.ts:516`<br>`frontend/src/components/admin/AdminUsersTab.ts:420` |  |
| DELETE | `/api/v1/admin/users/{user_id}` | `frontend/src/services/api/AdminApiService.ts:38` `AdminApiService.deleteUser` | `frontend/src/components/admin/AdminUsersTab.ts:485` |  |
| GET | `/api/v1/admin/users/{user_id}` | `frontend/src/services/api/AdminApiService.ts:34` `AdminApiService.getUser` | `frontend/src/components/admin/AdminUsersTab.ts:441` |  |
| POST | `/api/v1/admin/users/{user_id}/memberships` | `frontend/src/services/api/AdminApiService.ts:46` `AdminApiService.addMembership` | `frontend/src/components/admin/AdminUsersTab.ts:472` |  |
| DELETE | `/api/v1/admin/users/{user_id}/memberships/{simulation_id}` | `frontend/src/services/api/AdminApiService.ts:61` `AdminApiService.removeMembership` | `frontend/src/components/admin/AdminUsersTab.ts:460` |  |
| PUT | `/api/v1/admin/users/{user_id}/memberships/{simulation_id}` | `frontend/src/services/api/AdminApiService.ts:57` `AdminApiService.changeMembershipRole` | `frontend/src/components/admin/AdminUsersTab.ts:449` |  |
| PUT | `/api/v1/admin/users/{user_id}/wallet` | `frontend/src/services/api/AdminApiService.ts:68` `AdminApiService.updateUserWallet` | `frontend/src/components/admin/AdminUsersTab.ts:502` |  |
| GET | `/api/v1/anchors` | `frontend/src/services/api/HeartbeatApiService.ts:97` `HeartbeatApiService.listAnchors` | `frontend/src/components/health/SimulationHealthView.ts:851` |  |
| POST | `/api/v1/anchors` | `frontend/src/services/api/HeartbeatApiService.ts:104` `HeartbeatApiService.createAnchor` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/anchors/{anchor_id}/join` | `frontend/src/services/api/HeartbeatApiService.ts:108` `HeartbeatApiService.joinAnchor` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/anchors/{anchor_id}/leave` | `frontend/src/services/api/HeartbeatApiService.ts:112` `HeartbeatApiService.leaveAnchor` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/bonds` | `frontend/src/services/api/BondsApiService.ts:61` `BondsApiService.listBonds` | `frontend/src/components/bonds/VelgBondPanel.ts:381` |  |
| POST | `/api/v1/bonds/form` | `frontend/src/services/api/BondsApiService.ts:85` `BondsApiService.formBond` | `frontend/src/components/bonds/VelgBondFormation.ts:141` |  |
| GET | `/api/v1/bonds/recognition-candidates` | `frontend/src/services/api/BondsApiService.ts:78` `BondsApiService.getRecognitionCandidates` | `frontend/src/components/bonds/BondsView.ts:51` |  |
| POST | `/api/v1/bonds/track-attention` | `frontend/src/services/api/BondsApiService.ts:71` `BondsApiService.trackAttention` | `frontend/src/components/agents/AgentDetailsPanel.ts:671` |  |
| GET | `/api/v1/bonds/{bond_id}` | `frontend/src/services/api/BondsApiService.ts:66` `BondsApiService.getBondDetail` | `frontend/src/components/bonds/VelgBondPanel.ts:396` |  |
| GET | `/api/v1/bonds/{bond_id}/whispers` | `frontend/src/services/api/BondsApiService.ts:90` `BondsApiService.listWhispers` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/bonds/{bond_id}/whispers/{whisper_id}/acted` | `frontend/src/services/api/BondsApiService.ts:103` `BondsApiService.markWhisperActed` | `frontend/src/components/bonds/VelgBondPanel.ts:422` |  |
| POST | `/api/v1/bonds/{bond_id}/whispers/{whisper_id}/read` | `frontend/src/services/api/BondsApiService.ts:98` `BondsApiService.markWhisperRead` | `frontend/src/components/bonds/VelgBondPanel.ts:411` |  |
| GET | `/api/v1/bot-players` | `frontend/src/services/api/BotApiService.ts:13` `BotApiService.listPresets` | `frontend/src/components/epoch/BotConfigPanel.ts:717` |  |
| POST | `/api/v1/bot-players` | `frontend/src/services/api/BotApiService.ts:23` `BotApiService.createPreset` | `frontend/src/components/epoch/BotConfigPanel.ts:738` |  |
| DELETE | `/api/v1/bot-players/{bot_id}` | `frontend/src/services/api/BotApiService.ts:41` `BotApiService.deletePreset` | `frontend/src/components/epoch/BotConfigPanel.ts:758` |  |
| PATCH | `/api/v1/bot-players/{bot_id}` | `frontend/src/services/api/BotApiService.ts:36` `BotApiService.updatePreset` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/connections` | `frontend/src/services/api/ConnectionsApiService.ts:17` `ConnectionsApiService.listAll` | `frontend/src/components/events/EventDetailsPanel.ts:859` |  |
| GET | `/api/v1/drift/chart` | `frontend/src/services/api/DriftApiService.ts:32` `DriftApiService.getChart` | `frontend/src/components/drift/DriftView.ts:542`<br>`frontend/src/components/drift/DriftView.ts:569` |  |
| POST | `/api/v1/drift/clearance-exam` | `frontend/src/services/api/DriftApiService.ts:53` `DriftApiService.sitClearanceExam` | `frontend/src/components/drift/DriftView.ts:671` |  |
| GET | `/api/v1/drift/dock/{simulation_id}` | `frontend/src/services/api/DriftApiService.ts:106` `DriftApiService.getDock` | `frontend/src/components/drift/DriftView.ts:1021` |  |
| GET | `/api/v1/drift/honors` | `frontend/src/services/api/DriftApiService.ts:111` `DriftApiService.getHonors` | `frontend/src/components/drift/DriftView.ts:546`<br>`frontend/src/components/drift/DriftView.ts:609` |  |
| GET | `/api/v1/drift/logbook` | `frontend/src/services/api/DriftApiService.ts:101` `DriftApiService.getLogbook` | `frontend/src/components/drift/DriftView.ts:548`<br>`frontend/src/components/drift/DriftView.ts:686` |  |
| GET | `/api/v1/drift/profile` | `frontend/src/services/api/DriftApiService.ts:48` `DriftApiService.getProfile` | `frontend/src/components/drift/DriftView.ts:547`<br>`frontend/src/components/drift/DriftView.ts:661` |  |
| GET | `/api/v1/drift/quests` | `frontend/src/services/api/DriftApiService.ts:144` `DriftApiService.getQuests` | `frontend/src/components/drift/DriftView.ts:545`<br>`frontend/src/components/drift/DriftView.ts:602` |  |
| POST | `/api/v1/drift/quests/accept` | `frontend/src/services/api/DriftApiService.ts:154` `DriftApiService.acceptQuest` | `frontend/src/components/drift/DriftView.ts:620` |  |
| POST | `/api/v1/drift/quests/{instance_id}/advance` | `frontend/src/services/api/DriftApiService.ts:168` `DriftApiService.advanceQuest` | `frontend/src/components/drift/DriftView.ts:646` |  |
| GET | `/api/v1/drift/run` | `frontend/src/services/api/DriftApiService.ts:116` `DriftApiService.getRun` | `frontend/src/components/drift/DriftView.ts:543`<br>`frontend/src/components/drift/DriftView.ts:596` |  |
| POST | `/api/v1/drift/run` | `frontend/src/services/api/DriftApiService.ts:121` `DriftApiService.openRun` | `frontend/src/components/drift/DriftView.ts:1293` |  |
| POST | `/api/v1/drift/run/{run_id}/abandon` | `frontend/src/services/api/DriftApiService.ts:139` `DriftApiService.abandon` | `frontend/src/components/drift/DriftView.ts:1326` |  |
| POST | `/api/v1/drift/run/{run_id}/bank` | `frontend/src/services/api/DriftApiService.ts:96` `DriftApiService.bankHaul` | `frontend/src/components/drift/DriftView.ts:769` |  |
| POST | `/api/v1/drift/run/{run_id}/complete` | `frontend/src/services/api/DriftApiService.ts:134` `DriftApiService.complete` | `frontend/src/components/drift/DriftView.ts:1310` |  |
| POST | `/api/v1/drift/run/{run_id}/havarie/resolve` | `frontend/src/services/api/DriftApiService.ts:66` `DriftApiService.resolveHavarie` | `frontend/src/components/drift/DriftView.ts:873` |  |
| POST | `/api/v1/drift/run/{run_id}/move` | `frontend/src/services/api/DriftApiService.ts:126` `DriftApiService.move` | `frontend/src/components/drift/DriftView.ts:1300` |  |
| POST | `/api/v1/drift/run/{run_id}/signal/resolve` | `frontend/src/services/api/DriftApiService.ts:82` `DriftApiService.resolveSignal` | `frontend/src/components/drift/DriftView.ts:704` |  |
| POST | `/api/v1/drift/run/{run_id}/sondieren` | `frontend/src/services/api/DriftApiService.ts:91` `DriftApiService.sondieren` | `frontend/src/components/drift/DriftView.ts:741` |  |
| GET | `/api/v1/drift/tuning` | `frontend/src/services/api/DriftApiService.ts:42` `DriftApiService.getTuning` | `frontend/src/components/drift/DriftView.ts:544` |  |
| GET | `/api/v1/dungeons/agents/{agent_id}/loot-effects` | `frontend/src/services/api/DungeonApiService.ts:149` `DungeonApiService.getAgentLootEffects` | `frontend/src/components/agents/AgentDungeonRewards.ts:222` |  |
| GET | `/api/v1/dungeons/available` | `frontend/src/services/api/DungeonApiService.ts:42` `DungeonApiService.getAvailable` | `frontend/src/components/dungeon/DungeonSimPicker.ts:194`<br>`frontend/src/services/DungeonStateManager.ts:480` |  |
| GET | `/api/v1/dungeons/history` | `frontend/src/services/api/DungeonApiService.ts:160` `DungeonApiService.getHistory` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/dungeons/runs` | `frontend/src/services/api/DungeonApiService.ts:47` `DungeonApiService.createRun` | `frontend/src/utils/dungeon-entry-flow.ts:319` |  |
| GET | `/api/v1/dungeons/runs/{run_id}` | `frontend/src/services/api/DungeonApiService.ts:52` `DungeonApiService.getRun` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/dungeons/runs/{run_id}/action` | `frontend/src/services/api/DungeonApiService.ts:70` `DungeonApiService.submitAction` | `frontend/src/utils/dungeon-commands.ts:811` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/combat/submit` | `frontend/src/services/api/DungeonApiService.ts:78` `DungeonApiService.submitCombat` | `frontend/src/utils/dungeon-commands.ts:1002`<br>`frontend/src/services/DungeonStateManager.ts:599` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/distribute` | `frontend/src/services/api/DungeonApiService.ts:128` `DungeonApiService.assignLoot` | `frontend/src/utils/dungeon-commands.ts:707` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/distribute/confirm` | `frontend/src/services/api/DungeonApiService.ts:133` `DungeonApiService.confirmDistribution` | `frontend/src/utils/dungeon-commands.ts:753` |  |
| GET | `/api/v1/dungeons/runs/{run_id}/events` | `frontend/src/services/api/DungeonApiService.ts:138` `DungeonApiService.getEvents` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/dungeons/runs/{run_id}/ground` | `frontend/src/services/api/DungeonApiService.ts:93` `DungeonApiService.ground` | `frontend/src/utils/dungeon-commands.ts:1146` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/move` | `frontend/src/services/api/DungeonApiService.ts:62` `DungeonApiService.moveToRoom` | `frontend/src/utils/dungeon-commands.ts:321` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/rally` | `frontend/src/services/api/DungeonApiService.ts:98` `DungeonApiService.rally` | `frontend/src/utils/dungeon-commands.ts:1181` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/rest` | `frontend/src/services/api/DungeonApiService.ts:115` `DungeonApiService.rest` | `frontend/src/utils/dungeon-commands.ts:568` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/retreat` | `frontend/src/services/api/DungeonApiService.ts:120` `DungeonApiService.retreat` | `frontend/src/utils/dungeon-commands.ts:599` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/salvage` | `frontend/src/services/api/DungeonApiService.ts:107` `DungeonApiService.salvage` | `frontend/src/utils/dungeon-commands.ts:1232` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/scout` | `frontend/src/services/api/DungeonApiService.ts:83` `DungeonApiService.scout` | `frontend/src/utils/dungeon-commands.ts:526` |  |
| POST | `/api/v1/dungeons/runs/{run_id}/seal` | `frontend/src/services/api/DungeonApiService.ts:88` `DungeonApiService.seal` | `frontend/src/utils/dungeon-commands.ts:1111` |  |
| GET | `/api/v1/dungeons/runs/{run_id}/state` | `frontend/src/services/api/DungeonApiService.ts:57` `DungeonApiService.getState` | `frontend/src/services/DungeonStateManager.ts:407`<br>`frontend/src/services/DungeonStateManager.ts:439`<br>`frontend/src/services/DungeonStateManager.ts:659` |  |
| GET | `/api/v1/epochs` | `frontend/src/services/api/EpochsApiService.ts:40` `EpochsApiService.listEpochs` | `frontend/src/components/epoch/EpochCommandCenter.ts:1584` |  |
| POST | `/api/v1/epochs` | `frontend/src/services/api/EpochsApiService.ts:61` `EpochsApiService.createEpoch` | `frontend/src/components/epoch/EpochCreationWizard.ts:1146` |  |
| GET | `/api/v1/epochs/active` | `frontend/src/services/api/EpochsApiService.ts:45` `EpochsApiService.getActiveEpochs` | `frontend/src/components/epoch/EpochCommandCenter.ts:1530` |  |
| POST | `/api/v1/epochs/quick-academy` | `frontend/src/services/api/EpochsApiService.ts:65` `EpochsApiService.createQuickAcademy` | `frontend/src/components/platform/SimulationsDashboard.ts:1631`<br>`frontend/src/components/forge/VelgForgeClearanceRequired.ts:291` |  |
| DELETE | `/api/v1/epochs/{epoch_id}` | `frontend/src/services/api/EpochsApiService.ts:87` `EpochsApiService.deleteEpoch` | `frontend/src/components/epoch/EpochCommandCenter.ts:2634`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2657` |  |
| GET | `/api/v1/epochs/{epoch_id}` | `frontend/src/services/api/EpochsApiService.ts:52` `EpochsApiService.getEpoch` | `frontend/src/utils/terminal-commands.ts:569`<br>`frontend/src/utils/terminal-commands.ts:1087`<br>`frontend/src/components/epoch/EpochInvitePanel.ts:359`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1567`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1625` |  |
| PATCH | `/api/v1/epochs/{epoch_id}` | `frontend/src/services/api/EpochsApiService.ts:69` `EpochsApiService.updateEpoch` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/epochs/{epoch_id}/add-bot` | `frontend/src/services/api/BotApiService.ts:50` `BotApiService.addBotToEpoch` | `frontend/src/components/epoch/BotConfigPanel.ts:771` |  |
| POST | `/api/v1/epochs/{epoch_id}/advance` | `frontend/src/services/api/EpochsApiService.ts:79` `EpochsApiService.advancePhase` | `frontend/src/components/epoch/EpochCommandCenter.ts:2540` |  |
| GET | `/api/v1/epochs/{epoch_id}/battle-log` | `frontend/src/services/api/EpochsApiService.ts:340` `EpochsApiService.getBattleLog` | `frontend/src/components/epoch/EpochCommandCenter.ts:1718`<br>`frontend/src/components/epoch/WarRoomPanel.ts:519` |  |
| GET | `/api/v1/epochs/{epoch_id}/battle-log/summary` | `frontend/src/services/api/EpochsApiService.ts:317` `EpochsApiService.getCycleSummary` | `frontend/src/components/epoch/WarRoomPanel.ts:509` |  |
| POST | `/api/v1/epochs/{epoch_id}/cancel` | `frontend/src/services/api/EpochsApiService.ts:83` `EpochsApiService.cancelEpoch` | `frontend/src/components/epoch/EpochCommandCenter.ts:2611` |  |
| GET | `/api/v1/epochs/{epoch_id}/chat` | `frontend/src/services/api/EpochChatApiService.ts:29` `EpochChatApiServiceImpl.listMessages` | `frontend/src/components/epoch/EpochChatPanel.ts:190`<br>`frontend/src/components/epoch/EpochChatPanel.ts:220` |  |
| POST | `/api/v1/epochs/{epoch_id}/chat` | `frontend/src/services/api/EpochChatApiService.ts:19` `EpochChatApiServiceImpl.sendMessage` | `frontend/src/components/epoch/EpochChatPanel.ts:241` |  |
| GET | `/api/v1/epochs/{epoch_id}/chat/team/{team_id}` | `frontend/src/services/api/EpochChatApiService.ts:40` `EpochChatApiServiceImpl.listTeamMessages` | `frontend/src/components/epoch/EpochChatPanel.ts:189`<br>`frontend/src/components/epoch/EpochChatPanel.ts:216` |  |
| GET | `/api/v1/epochs/{epoch_id}/invitations` | `frontend/src/services/api/EpochsApiService.ts:360` `EpochsApiService.listInvitations` | `frontend/src/components/epoch/EpochInvitePanel.ts:358` |  |
| POST | `/api/v1/epochs/{epoch_id}/invitations` | `frontend/src/services/api/EpochsApiService.ts:356` `EpochsApiService.sendInvitation` | `frontend/src/components/epoch/EpochInvitePanel.ts:376` |  |
| POST | `/api/v1/epochs/{epoch_id}/invitations/regenerate-lore` | `frontend/src/services/api/EpochsApiService.ts:368` `EpochsApiService.regenerateLore` | `frontend/src/components/epoch/EpochInvitePanel.ts:395` |  |
| DELETE | `/api/v1/epochs/{epoch_id}/invitations/{invitation_id}` | `frontend/src/services/api/EpochsApiService.ts:364` `EpochsApiService.revokeInvitation` | `frontend/src/components/epoch/EpochInvitePanel.ts:407` |  |
| GET | `/api/v1/epochs/{epoch_id}/operatives` | `frontend/src/services/api/EpochsApiService.ts:204` `EpochsApiService.listMissions` | `frontend/src/utils/terminal-commands.ts:535`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1729` |  |
| POST | `/api/v1/epochs/{epoch_id}/operatives` | `frontend/src/services/api/EpochsApiService.ts:224` `EpochsApiService.deployOperative` | `frontend/src/components/epoch/DeployOperativeModal.ts:623` |  |
| POST | `/api/v1/epochs/{epoch_id}/operatives/counter-intel` | `frontend/src/services/api/EpochsApiService.ts:247` `EpochsApiService.counterIntelSweep` | `frontend/src/utils/terminal-commands.ts:1186`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2452` |  |
| POST | `/api/v1/epochs/{epoch_id}/operatives/fortify-zone` | `frontend/src/services/api/EpochsApiService.ts:255` `EpochsApiService.fortifyZone` | `frontend/src/components/epoch/EpochCommandCenter.ts:2468` |  |
| POST | `/api/v1/epochs/{epoch_id}/operatives/resolve` | `frontend/src/services/api/EpochsApiService.ts:95` `EpochsApiService.resolveOperatives` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/epochs/{epoch_id}/operatives/threats` | `frontend/src/services/api/EpochsApiService.ts:238` `EpochsApiService.listThreats` | `frontend/src/utils/terminal-commands.ts:313`<br>`frontend/src/utils/terminal-commands.ts:1169`<br>`frontend/src/utils/terminal-commands.ts:1206`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1736` |  |
| GET | `/api/v1/epochs/{epoch_id}/operatives/{mission_id}` | `frontend/src/services/api/EpochsApiService.ts:208` `EpochsApiService.getMission` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/epochs/{epoch_id}/operatives/{mission_id}/recall` | `frontend/src/services/api/EpochsApiService.ts:232` `EpochsApiService.recallOperative` | `frontend/src/components/epoch/EpochCommandCenter.ts:2783` |  |
| GET | `/api/v1/epochs/{epoch_id}/participants` | `frontend/src/services/api/EpochsApiService.ts:111` `EpochsApiService.listParticipants` | `frontend/src/utils/terminal-commands.ts:550`<br>`frontend/src/utils/terminal-commands.ts:1197`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1536`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1590`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1651`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1687`<br>(+1 more) |  |
| POST | `/api/v1/epochs/{epoch_id}/participants` | `frontend/src/services/api/EpochsApiService.ts:115` `EpochsApiService.joinEpoch` | `frontend/src/components/epoch/EpochCommandCenter.ts:2113`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2486` |  |
| DELETE | `/api/v1/epochs/{epoch_id}/participants/{simulation_id}` | `frontend/src/services/api/EpochsApiService.ts:121` `EpochsApiService.leaveEpoch` | `frontend/src/components/epoch/EpochCommandCenter.ts:2509` |  |
| POST | `/api/v1/epochs/{epoch_id}/participants/{simulation_id}/draft` | `frontend/src/services/api/EpochsApiService.ts:129` `EpochsApiService.draftAgents` | `frontend/src/components/epoch/EpochCommandCenter.ts:2431` |  |
| POST | `/api/v1/epochs/{epoch_id}/pass-cycle` | `frontend/src/services/api/EpochChatApiService.ts:55` `EpochChatApiServiceImpl.passCycle` | `frontend/src/components/epoch/EpochReadyPanel.ts:533` |  |
| GET | `/api/v1/epochs/{epoch_id}/proposals` | `frontend/src/services/api/EpochsApiService.ts:162` `EpochsApiService.listProposals` | `frontend/src/components/epoch/EpochCommandCenter.ts:1690` |  |
| POST | `/api/v1/epochs/{epoch_id}/proposals` | `frontend/src/services/api/EpochsApiService.ts:170` `EpochsApiService.createProposal` | `frontend/src/components/epoch/EpochCommandCenter.ts:2727` |  |
| POST | `/api/v1/epochs/{epoch_id}/proposals/{proposal_id}/vote` | `frontend/src/services/api/EpochsApiService.ts:192` `EpochsApiService.voteOnProposal` | `frontend/src/components/epoch/EpochCommandCenter.ts:2744` |  |
| POST | `/api/v1/epochs/{epoch_id}/ready` | `frontend/src/services/api/EpochChatApiService.ts:48` `EpochChatApiServiceImpl.setReady` | `frontend/src/components/epoch/EpochReadyPanel.ts:498` |  |
| DELETE | `/api/v1/epochs/{epoch_id}/remove-bot/{participant_id}` | `frontend/src/services/api/BotApiService.ts:58` `BotApiService.removeBotFromEpoch` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/epochs/{epoch_id}/resolve-cycle` | `frontend/src/services/api/EpochsApiService.ts:91` `EpochsApiService.resolveCycle` | `frontend/src/components/epoch/EpochCommandCenter.ts:2553` |  |
| GET | `/api/v1/epochs/{epoch_id}/results-summary` | `frontend/src/services/api/EpochsApiService.ts:301` `EpochsApiService.getResultsSummary` | `frontend/src/components/epoch/EpochResultsView.ts:705` |  |
| POST | `/api/v1/epochs/{epoch_id}/scores/compute` | `frontend/src/services/api/EpochsApiService.ts:99` `EpochsApiService.computeScores` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/epochs/{epoch_id}/scores/intel-dossiers` | `frontend/src/services/api/EpochsApiService.ts:305` `EpochsApiService.getIntelDossiers` | `frontend/src/utils/terminal-commands.ts:1140`<br>`frontend/src/components/epoch/EpochIntelDossierTab.ts:457` |  |
| GET | `/api/v1/epochs/{epoch_id}/scores/leaderboard` | `frontend/src/services/api/EpochsApiService.ts:276` `EpochsApiService.getLeaderboard` | `frontend/src/utils/terminal-commands.ts:534`<br>`frontend/src/components/multiverse/MapLeaderboardPanel.ts:146`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1689` |  |
| GET | `/api/v1/epochs/{epoch_id}/scores/simulations/{simulation_id}` | `frontend/src/services/api/EpochsApiService.ts:290` `EpochsApiService.getScoreHistory` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/epochs/{epoch_id}/scores/standings` | `frontend/src/services/api/EpochsApiService.ts:286` `EpochsApiService.getFinalStandings` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/epochs/{epoch_id}/sitrep/{cycle_number}` | `frontend/src/services/api/EpochsApiService.ts:327` `EpochsApiService.getSitrep` | `frontend/src/utils/terminal-commands.ts:1093`<br>`frontend/src/components/epoch/WarRoomPanel.ts:535` |  |
| POST | `/api/v1/epochs/{epoch_id}/start` | `frontend/src/services/api/EpochsApiService.ts:75` `EpochsApiService.startEpoch` | `frontend/src/components/epoch/EpochCommandCenter.ts:2525` |  |
| GET | `/api/v1/epochs/{epoch_id}/teams` | `frontend/src/services/api/EpochsApiService.ts:140` `EpochsApiService.listTeams` | `frontend/src/components/epoch/EpochCommandCenter.ts:1688` |  |
| POST | `/api/v1/epochs/{epoch_id}/teams` | `frontend/src/services/api/EpochsApiService.ts:144` `EpochsApiService.createTeam` | `frontend/src/components/epoch/EpochCommandCenter.ts:2672` |  |
| POST | `/api/v1/epochs/{epoch_id}/teams/leave` | `frontend/src/services/api/EpochsApiService.ts:156` `EpochsApiService.leaveTeam` | `frontend/src/components/epoch/EpochCommandCenter.ts:2714` |  |
| POST | `/api/v1/epochs/{epoch_id}/teams/{team_id}/invite` | `frontend/src/services/api/EpochsApiService.ts:181` `EpochsApiService.inviteToTeam` | `frontend/src/components/epoch/EpochCommandCenter.ts:2762` |  |
| POST | `/api/v1/epochs/{epoch_id}/teams/{team_id}/join` | `frontend/src/services/api/EpochsApiService.ts:152` `EpochsApiService.joinTeam` | `frontend/src/components/epoch/EpochCommandCenter.ts:2689` |  |
| POST | `/api/v1/forge/access-requests` | `frontend/src/services/api/ForgeApiService.ts:415` `ForgeApiService.requestAccess` | `frontend/src/components/forge/ForgeAccessRequestModal.ts:343` |  |
| GET | `/api/v1/forge/access-requests/me` | `frontend/src/services/api/ForgeApiService.ts:419` `ForgeApiService.getMyAccessRequest` | `frontend/src/services/supabase/SupabaseAuthService.ts:182` |  |
| GET | `/api/v1/forge/access-requests/pending` | `frontend/src/services/api/ForgeApiService.ts:423` `ForgeApiService.listPendingRequests` | `frontend/src/components/forge/ClearanceQueue.ts:317` |  |
| GET | `/api/v1/forge/access-requests/pending/count` | `frontend/src/services/api/ForgeApiService.ts:427` `ForgeApiService.getPendingRequestCount` | `frontend/src/services/supabase/SupabaseAuthService.ts:238` |  |
| POST | `/api/v1/forge/access-requests/{request_id}/review` | `frontend/src/services/api/ForgeApiService.ts:435` `ForgeApiService.reviewRequest` | `frontend/src/components/forge/ClearanceQueue.ts:348` |  |
| GET | `/api/v1/forge/admin/bundles` | `frontend/src/services/api/AdminApiService.ts:110` `AdminApiService.listAllBundles` | `frontend/src/components/admin/AdminForgeTab.ts:465` |  |
| PUT | `/api/v1/forge/admin/bundles/{bundle_id}` | `frontend/src/services/api/AdminApiService.ts:117` `AdminApiService.updateBundle` | `frontend/src/components/admin/AdminForgeTab.ts:512`<br>`frontend/src/components/admin/AdminForgeTab.ts:553` |  |
| PUT | `/api/v1/forge/admin/byok-access-policy` | `frontend/src/services/api/AdminApiService.ts:161` `AdminApiService.updateBYOKAccessPolicy` | `frontend/src/components/admin/AdminForgeTab.ts:658` |  |
| GET | `/api/v1/forge/admin/byok-setting` | `frontend/src/services/api/AdminApiService.ts:149` `AdminApiService.getBYOKSystemSetting` | `frontend/src/components/admin/AdminForgeTab.ts:492` |  |
| PUT | `/api/v1/forge/admin/byok-setting` | `frontend/src/services/api/AdminApiService.ts:155` `AdminApiService.updateBYOKSystemSetting` | `frontend/src/components/admin/AdminForgeTab.ts:638` |  |
| GET | `/api/v1/forge/admin/economy` | `frontend/src/services/api/AdminApiService.ts:106` `AdminApiService.getTokenEconomyStats` | `frontend/src/components/admin/AdminForgeTab.ts:454` |  |
| POST | `/api/v1/forge/admin/grant` | `frontend/src/services/api/AdminApiService.ts:138` `AdminApiService.grantTokens` | `frontend/src/components/admin/AdminForgeTab.ts:589` |  |
| GET | `/api/v1/forge/admin/purchases` | `frontend/src/services/api/AdminApiService.ts:130` `AdminApiService.listPurchases` | `frontend/src/components/admin/AdminForgeTab.ts:476` |  |
| DELETE | `/api/v1/forge/admin/purge` | `frontend/src/services/api/ForgeApiService.ts:450` `ForgeApiService.purgeStale` | `frontend/src/components/admin/AdminForgeTab.ts:687` |  |
| GET | `/api/v1/forge/admin/stats` | `frontend/src/services/api/ForgeApiService.ts:446` `ForgeApiService.getAdminStats` | `frontend/src/components/admin/AdminForgeTab.ts:440` |  |
| PUT | `/api/v1/forge/admin/user-byok-allowed/{target_user_id}` | `frontend/src/services/api/AdminApiService.ts:169` `AdminApiService.updateUserBYOKAllowed` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/forge/admin/user-byok-bypass/{target_user_id}` | `frontend/src/services/api/AdminApiService.ts:165` `AdminApiService.updateUserBYOKBypass` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/forge/bundles` | `frontend/src/services/api/ForgeApiService.ts:302` `ForgeApiService.listBundles` | `frontend/src/services/ForgeStateManager.ts:670` |  |
| GET | `/api/v1/forge/drafts` | `frontend/src/services/api/ForgeApiService.ts:228` `ForgeApiService.listDrafts` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/forge/drafts` | `frontend/src/services/api/ForgeApiService.ts:232` `ForgeApiService.createDraft` | `frontend/src/services/ForgeStateManager.ts:242` |  |
| DELETE | `/api/v1/forge/drafts/{draft_id}` | `frontend/src/services/api/ForgeApiService.ts:244` `ForgeApiService.deleteDraft` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/forge/drafts/{draft_id}` | `frontend/src/services/api/ForgeApiService.ts:236` `ForgeApiService.getDraft` | `frontend/src/services/ForgeStateManager.ts:196` |  |
| PATCH | `/api/v1/forge/drafts/{draft_id}` | `frontend/src/services/api/ForgeApiService.ts:240` `ForgeApiService.updateDraft` | `frontend/src/services/ForgeStateManager.ts:304` |  |
| POST | `/api/v1/forge/drafts/{draft_id}/generate-entity/{entity_type}` | `frontend/src/services/api/ForgeApiService.ts:261` `ForgeApiService.generateEntity` | `frontend/src/services/ForgeStateManager.ts:471` |  |
| POST | `/api/v1/forge/drafts/{draft_id}/generate-theme` | `frontend/src/services/api/ForgeApiService.ts:267` `ForgeApiService.generateTheme` | `frontend/src/services/ForgeStateManager.ts:592` |  |
| POST | `/api/v1/forge/drafts/{draft_id}/generate/{chunk_type}` | `frontend/src/services/api/ForgeApiService.ts:252` `ForgeApiService.generateChunk` | `frontend/src/services/ForgeStateManager.ts:393` |  |
| POST | `/api/v1/forge/drafts/{draft_id}/ignite` | `frontend/src/services/api/ForgeApiService.ts:275` `ForgeApiService.ignite` | `frontend/src/services/ForgeStateManager.ts:624` |  |
| POST | `/api/v1/forge/drafts/{draft_id}/research` | `frontend/src/services/api/ForgeApiService.ts:248` `ForgeApiService.runResearch` | `frontend/src/services/ForgeStateManager.ts:339` |  |
| GET | `/api/v1/forge/features/{purchase_id}` | `frontend/src/services/api/ForgeApiService.ts:391` `ForgeApiService.getFeaturePurchase` | `frontend/src/services/ForgeStateManager.ts:832` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/chronicle` | `frontend/src/services/api/ForgeApiService.ts:383` `ForgeApiService.purchaseChronicle` | `frontend/src/services/ForgeStateManager.ts:811` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/chronicle/hires` | `frontend/src/services/api/ForgeApiService.ts:387` `ForgeApiService.purchaseHiresArchive` | `frontend/src/services/ForgeStateManager.ts:809` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/darkroom` | `frontend/src/services/api/ForgeApiService.ts:350` `ForgeApiService.purchaseDarkroom` | `frontend/src/services/ForgeStateManager.ts:799` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/darkroom/regenerate/{entity_type}/{entity_id}` | `frontend/src/services/api/ForgeApiService.ts:361` `ForgeApiService.darkroomRegen` | `frontend/src/components/forge/VelgDarkroomStudio.ts:714` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/dossier` | `frontend/src/services/api/ForgeApiService.ts:368` `ForgeApiService.purchaseDossier` | `frontend/src/services/ForgeStateManager.ts:802` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/dossier/evolve` | `frontend/src/services/api/ForgeApiService.ts:409` `ForgeApiService.evolveDossier` | `frontend/src/components/lore/VelgBureauStatus.ts:559` |  |
| GET | `/api/v1/forge/simulations/{simulation_id}/features` | `frontend/src/services/api/ForgeApiService.ts:344` `ForgeApiService.listFeaturePurchases` | `frontend/src/services/ForgeStateManager.ts:753` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/generate-missing-images` | `frontend/src/services/api/ForgeApiService.ts:294` `ForgeApiService.generateMissingImages` | `frontend/src/components/forge/VelgForgeCeremony.ts:1945` |  |
| POST | `/api/v1/forge/simulations/{simulation_id}/recruit` | `frontend/src/services/api/ForgeApiService.ts:376` `ForgeApiService.purchaseRecruitment` | `frontend/src/services/ForgeStateManager.ts:805` |  |
| GET | `/api/v1/forge/wallet` | `frontend/src/services/api/ForgeApiService.ts:298` `ForgeApiService.getWallet` | `frontend/src/services/supabase/SupabaseAuthService.ts:178`<br>`frontend/src/services/ForgeStateManager.ts:650` |  |
| GET | `/api/v1/forge/wallet/history` | `frontend/src/services/api/ForgeApiService.ts:316` `ForgeApiService.getPurchaseHistory` | `frontend/src/services/ForgeStateManager.ts:701` |  |
| PUT | `/api/v1/forge/wallet/keys` | `frontend/src/services/api/ForgeApiService.ts:323` `ForgeApiService.updateBYOK` | `frontend/src/components/forge/VelgByokPanel.ts:996` |  |
| POST | `/api/v1/forge/wallet/keys/test` | `frontend/src/services/api/ForgeApiService.ts:334` `ForgeApiService.testBYOK` | `frontend/src/components/forge/VelgByokPanel.ts:951` |  |
| DELETE | `/api/v1/forge/wallet/keys/{provider}` | `frontend/src/services/api/ForgeApiService.ts:327` `ForgeApiService.deleteBYOK` | `frontend/src/components/forge/VelgByokPanel.ts:1032` |  |
| POST | `/api/v1/forge/wallet/purchase` | `frontend/src/services/api/ForgeApiService.ts:306` `ForgeApiService.purchaseBundle` | `frontend/src/services/ForgeStateManager.ts:683` |  |
| GET | `/api/v1/invitations/{token}` | `frontend/src/services/api/InvitationsApiService.ts:22` `InvitationsApiService.validate` | `frontend/src/components/platform/InvitationAcceptView.ts:211` |  |
| POST | `/api/v1/invitations/{token}/accept` | `frontend/src/services/api/InvitationsApiService.ts:26` `InvitationsApiService.accept` | `frontend/src/components/platform/InvitationAcceptView.ts:230` |  |
| GET | `/api/v1/journal/attunements` | `frontend/src/services/api/JournalApiService.ts:246` `JournalApiService.listAttunements` | `frontend/src/components/journal/VelgAttunementPanel.ts:268` |  |
| GET | `/api/v1/journal/constellations` | `frontend/src/services/api/JournalApiService.ts:180` `JournalApiService.listConstellations` | `frontend/src/components/journal/VelgConstellationList.ts:315` |  |
| POST | `/api/v1/journal/constellations` | `frontend/src/services/api/JournalApiService.ts:193` `JournalApiService.createConstellation` | `frontend/src/components/journal/VelgConstellationList.ts:339` |  |
| GET | `/api/v1/journal/constellations/{constellation_id}` | `frontend/src/services/api/JournalApiService.ts:185` `JournalApiService.getConstellation` | `frontend/src/components/journal/VelgConstellationCanvas.ts:784` |  |
| PATCH | `/api/v1/journal/constellations/{constellation_id}` | `frontend/src/services/api/JournalApiService.ts:201` `JournalApiService.renameConstellation` | `frontend/src/components/journal/VelgConstellationCanvas.ts:1052` |  |
| POST | `/api/v1/journal/constellations/{constellation_id}/archive` | `frontend/src/services/api/JournalApiService.ts:206` `JournalApiService.archiveConstellation` | `frontend/src/components/journal/VelgConstellationCanvas.ts:1070` |  |
| POST | `/api/v1/journal/constellations/{constellation_id}/crystallize` | `frontend/src/services/api/JournalApiService.ts:234` `JournalApiService.crystallizeConstellation` | `frontend/src/components/journal/VelgConstellationCanvas.ts:1086` |  |
| DELETE | `/api/v1/journal/constellations/{constellation_id}/fragments/{fragment_id}` | `frontend/src/services/api/JournalApiService.ts:219` `JournalApiService.removeFragment` | `frontend/src/components/journal/VelgConstellationCanvas.ts:1019` |  |
| POST | `/api/v1/journal/constellations/{constellation_id}/place` | `frontend/src/services/api/JournalApiService.ts:214` `JournalApiService.placeFragment` | `frontend/src/components/journal/VelgConstellationCanvas.ts:976`<br>`frontend/src/components/journal/VelgConstellationCanvas.ts:1000` |  |
| GET | `/api/v1/journal/fragments` | `frontend/src/services/api/JournalApiService.ts:166` `JournalApiService.listFragments` | `frontend/src/components/journal/VelgConstellationCanvas.ts:831`<br>`frontend/src/components/journal/VelgFragmentGrid.ts:226` |  |
| GET | `/api/v1/journal/fragments/{fragment_id}` | `frontend/src/services/api/JournalApiService.ts:171` `JournalApiService.getFragment` | `frontend/src/components/journal/VelgConstellationCanvas.ts:812` |  |
| GET | `/api/v1/public/alpha-state` | `frontend/src/services/api/AlphaStateApiService.ts:15` `AlphaStateApiService.getAlphaState` | `frontend/src/services/AlphaStatusService.ts:83` |  |
| GET | `/api/v1/public/battle-feed` | `frontend/src/services/api/ConnectionsApiService.ts:25` `ConnectionsApiService.getBattleFeed` | `frontend/src/components/multiverse/MapBattleFeed.ts:152` |  |
| GET | `/api/v1/public/bleed-gazette` | `frontend/src/services/api/ConnectionsApiService.ts:29` `ConnectionsApiService.getBleedGazette` | `frontend/src/components/multiverse/BleedGazetteSidebar.ts:315` |  |
| POST | `/api/v1/public/bureau/dispatch` | `frontend/src/services/api/BureauApiService.ts:22` `BureauApiService.redeemCipher` | `frontend/src/components/bureau/BureauDispatchView.ts:54` |  |
| GET | `/api/v1/public/chronicles` | `frontend/src/services/api/ChronicleApiService.ts:10` `ChronicleApiService.listGlobal` | `frontend/src/components/landing/ChronicleFeed.ts:250` |  |
| GET | `/api/v1/public/connections` | `frontend/src/services/api/ConnectionsApiService.ts:17` `ConnectionsApiService.listAll` | `frontend/src/components/events/EventDetailsPanel.ts:859` |  |
| GET | `/api/v1/public/drift/chart` | `frontend/src/services/api/DriftApiService.ts:32` `DriftApiService.getChart` | `frontend/src/components/drift/DriftView.ts:542`<br>`frontend/src/components/drift/DriftView.ts:569` |  |
| GET | `/api/v1/public/drift/state` | `frontend/src/services/api/DriftApiService.ts:37` `DriftApiService.getPublicState` | `frontend/src/services/DriftStatusService.ts:36` |  |
| GET | `/api/v1/public/dungeons/clearance-config` | `frontend/src/services/api/DungeonApiService.ts:188` `DungeonApiService.getClearanceConfig` | `frontend/src/services/TerminalStateManager.ts:404` |  |
| GET | `/api/v1/public/dungeons/runs/{run_id}` | `frontend/src/services/api/DungeonApiService.ts:171` `DungeonApiService.getRunPublic` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/embassies` | `frontend/src/services/api/EmbassiesApiService.ts:77` `EmbassiesApiService.listAllActive` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/epoch-invitations/{token}` | `frontend/src/services/api/EpochsApiService.ts:372` `EpochsApiService.validateEpochInvitation` | `frontend/src/components/epoch/EpochInviteAcceptView.ts:478` |  |
| GET | `/api/v1/public/epochs` | `frontend/src/services/api/EpochsApiService.ts:40` `EpochsApiService.listEpochs` | `frontend/src/components/epoch/EpochCommandCenter.ts:1584` |  |
| GET | `/api/v1/public/epochs/active` | `frontend/src/services/api/EpochsApiService.ts:45` `EpochsApiService.getActiveEpochs` | `frontend/src/components/epoch/EpochCommandCenter.ts:1530` |  |
| GET | `/api/v1/public/epochs/{epoch_id}` | `frontend/src/services/api/EpochsApiService.ts:51` `EpochsApiService.getEpoch` | `frontend/src/utils/terminal-commands.ts:569`<br>`frontend/src/utils/terminal-commands.ts:1087`<br>`frontend/src/components/epoch/EpochInvitePanel.ts:359`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1567`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1625` |  |
| GET | `/api/v1/public/epochs/{epoch_id}/battle-log` | `frontend/src/services/api/EpochsApiService.ts:339` `EpochsApiService.getBattleLog` | `frontend/src/components/epoch/EpochCommandCenter.ts:1718`<br>`frontend/src/components/epoch/WarRoomPanel.ts:519` |  |
| GET | `/api/v1/public/epochs/{epoch_id}/leaderboard` | `frontend/src/services/api/EpochsApiService.ts:275` `EpochsApiService.getLeaderboard` | `frontend/src/utils/terminal-commands.ts:534`<br>`frontend/src/components/multiverse/MapLeaderboardPanel.ts:146`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1689` |  |
| GET | `/api/v1/public/epochs/{epoch_id}/participants` | `frontend/src/services/api/EpochsApiService.ts:110` `EpochsApiService.listParticipants` | `frontend/src/utils/terminal-commands.ts:550`<br>`frontend/src/utils/terminal-commands.ts:1197`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1536`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1590`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1651`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1687`<br>(+1 more) |  |
| GET | `/api/v1/public/epochs/{epoch_id}/results-summary` | `frontend/src/services/api/EpochsApiService.ts:300` `EpochsApiService.getResultsSummary` | `frontend/src/components/epoch/EpochResultsView.ts:705` |  |
| GET | `/api/v1/public/epochs/{epoch_id}/standings` | `frontend/src/services/api/EpochsApiService.ts:285` `EpochsApiService.getFinalStandings` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/epochs/{epoch_id}/teams` | `frontend/src/services/api/EpochsApiService.ts:139` `EpochsApiService.listTeams` | `frontend/src/components/epoch/EpochCommandCenter.ts:1688` |  |
| GET | `/api/v1/public/map-data` | `frontend/src/services/api/ConnectionsApiService.ts:21` `ConnectionsApiService.getMapData` | `frontend/src/components/multiverse/CartographerMap.ts:299`<br>`frontend/src/components/multiverse/CartographerMap.ts:315` |  |
| GET | `/api/v1/public/platform-stats` | `frontend/src/services/api/SimulationsApiService.ts:53` `SimulationsApiService.getAnchor` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/resonances` | `frontend/src/services/api/ResonanceApiService.ts:17` `ResonanceApiService.list` | `frontend/src/components/platform/SimulationsDashboard.ts:1550`<br>`frontend/src/components/admin/AdminResonancesTab.ts:643` |  |
| GET | `/api/v1/public/resonances/{resonance_id}` | `frontend/src/services/api/ResonanceApiService.ts:24` `ResonanceApiService.getById` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/resonances/{resonance_id}/impacts` | `frontend/src/services/api/ResonanceApiService.ts:70` `ResonanceApiService.listImpacts` | `frontend/src/components/admin/AdminResonancesTab.ts:662`<br>`frontend/src/components/resonance/ResonanceCard.ts:843`<br>`frontend/src/components/resonance/ResonanceDetailsPanel.ts:711` |  |
| GET | `/api/v1/public/simulations` | `frontend/src/services/api/SimulationsApiService.ts:17` `SimulationsApiService.list` | `frontend/src/app-shell.ts:1030`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1520`<br>`frontend/src/components/layout/SimulationShell.ts:456`<br>`frontend/src/components/layout/SimulationShell.ts:458`<br>`frontend/src/components/platform/SimulationsDashboard.ts:1512`<br>`frontend/src/components/dungeon/DungeonEntryCta.ts:135`<br>(+2 more) |  |
| GET | `/api/v1/public/simulations/by-slug/{slug}/forge-progress` | `frontend/src/services/api/ForgeApiService.ts:283` `ForgeApiService.getForgeProgress` | `frontend/src/components/forge/VelgForgeCeremony.ts:1839`<br>`frontend/src/services/ForgeStateManager.ts:862` |  |
| GET | `/api/v1/public/simulations/{simulation_id}` | `frontend/src/services/api/SimulationsApiService.ts:24` `SimulationsApiService.getById` | `frontend/src/app-shell.ts:1086`<br>`frontend/src/components/settings/GeneralSettingsPanel.ts:160` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/agents` | `AgentsApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:219`<br>`frontend/src/utils/terminal-commands.ts:759`<br>`frontend/src/components/buildings/EmbassyCreateModal.ts:301`<br>`frontend/src/components/chat/AgentSelector.ts:285`<br>`frontend/src/components/epoch/DeployOperativeModal.ts:218`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2405`<br>(+4 more) |  |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/by-slug/{slug}` | `AgentsApiService.getBySlug` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/agents/AgentsView.ts:277` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}` | `AgentsApiService.getById` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:394`<br>`frontend/src/components/chat/ChatWindow.ts:872` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}/aptitudes` | `frontend/src/services/api/AgentsApiService.ts:41` `AgentsApiService.getAptitudes` | `frontend/src/components/agents/AgentDetailsPanel.ts:804` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}/memories` | `frontend/src/services/api/AgentMemoryApiService.ts:15` `AgentMemoryApiService.list` | `frontend/src/components/agents/AgentMemorySection.ts:306` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/agents/{agent_id}/relationships` | `frontend/src/services/api/RelationshipsApiService.ts:10` `RelationshipsApiService.listForAgent` | `frontend/src/components/agents/AgentDetailsPanel.ts:701` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/anchor` | `frontend/src/services/api/SimulationsApiService.ts:49` `SimulationsApiService.getAnchor` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/aptitudes` | `frontend/src/services/api/AgentsApiService.ts:56` `AgentsApiService.getAllAptitudes` | `frontend/src/components/landing/LandingAgentShowcase.ts:503`<br>`frontend/src/components/epoch/DeployOperativeModal.ts:219`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2406`<br>`frontend/src/components/agents/AgentsView.ts:313`<br>`frontend/src/services/DungeonStateManager.ts:505` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/bleed-status` | `frontend/src/services/api/HealthApiService.ts:34` `HealthApiService.getBleedStatus` | `frontend/src/components/layout/SimulationShell.ts:577` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/broadsheets` | `frontend/src/services/api/BroadsheetApiService.ts:16` `BroadsheetApiService.list` | `frontend/src/components/broadsheet/SimulationBroadsheet.ts:292` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/broadsheets/latest` | `frontend/src/services/api/BroadsheetApiService.ts:23` `BroadsheetApiService.getLatest` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings` | `BuildingsApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:228`<br>`frontend/src/components/buildings/BuildingsView.ts:73`<br>`frontend/src/components/shared/VelgStyleReferenceModal.ts:165` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings/by-slug/{slug}` | `BuildingsApiService.getBySlug` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/buildings/BuildingsView.ts:163` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings/{building_id}` | `BuildingsApiService.getById` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/buildings/{building_id}/embassy` | `frontend/src/services/api/EmbassiesApiService.ts:26` `EmbassiesApiService.getForBuilding` | `frontend/src/components/buildings/BuildingDetailsPanel.ts:406` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/campaigns` | `CampaignsApiService.list` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/chat/conversations` | `frontend/src/services/api/ChatApiService.ts:15` `ChatApiService.listConversations` | `frontend/src/components/chat/ChatView.ts:232` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages` | `frontend/src/services/api/ChatApiService.ts:31` `ChatApiService.getMessages` | `frontend/src/components/chat/ChatWindow.ts:536`<br>`frontend/src/components/chat/ChatWindow.ts:771` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/chronicles` | `frontend/src/services/api/ChronicleApiService.ts:21` `ChronicleApiService.list` | `frontend/src/components/chronicle/ChronicleView.ts:555` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/chronicles/{chronicle_id}` | `frontend/src/services/api/ChronicleApiService.ts:29` `ChronicleApiService.getOne` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/dungeons/history` | `frontend/src/services/api/DungeonApiService.ts:180` `DungeonApiService.getHistoryPublic` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/echoes` | `frontend/src/services/api/EchoesApiService.ts:10` `EchoesApiService.listForSimulation` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/embassies` | `frontend/src/services/api/EmbassiesApiService.ts:10` `EmbassiesApiService.listForSimulation` | `frontend/src/components/epoch/DeployOperativeModal.ts:238`<br>`frontend/src/components/agents/AgentDetailsPanel.ts:766`<br>`frontend/src/components/social/SocialTrendsView.ts:1004` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/embassies/{embassy_id}` | `frontend/src/services/api/EmbassiesApiService.ts:18` `EmbassiesApiService.getById` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/events` | `EventsApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:251`<br>`frontend/src/utils/terminal-commands.ts:917`<br>`frontend/src/components/chat/EventPicker.ts:221`<br>`frontend/src/components/social/SocialTrendsView.ts:1053`<br>`frontend/src/components/events/EventsView.ts:96`<br>`frontend/src/components/events/EventsView.ts:258` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/events/{event_id}` | `EventsApiService.getById` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:937`<br>`frontend/src/components/events/EventsView.ts:127` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/events/{event_id}/echoes` | `frontend/src/services/api/EchoesApiService.ts:18` `EchoesApiService.listForEvent` | `frontend/src/components/events/EventDetailsPanel.ts:827` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/health` | `frontend/src/services/api/HealthApiService.ts:15` `HealthApiService.getDashboard` | `frontend/src/utils/terminal-commands.ts:515`<br>`frontend/src/components/health/DesperateActionsPanel.ts:395`<br>`frontend/src/components/health/SimulationHealthView.ts:846`<br>`frontend/src/components/social/SocialTrendsView.ts:1005` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/health/buildings` | `frontend/src/services/api/HealthApiService.ts:23` `HealthApiService.listBuildingReadiness` | `frontend/src/utils/terminal-commands.ts:253`<br>`frontend/src/utils/terminal-commands.ts:417`<br>`frontend/src/components/buildings/BuildingDetailsPanel.ts:422` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/health/zones` | `frontend/src/services/api/HealthApiService.ts:30` `HealthApiService.listZoneStability` | `frontend/src/utils/terminal-commands.ts:250`<br>`frontend/src/utils/terminal-commands.ts:602`<br>`frontend/src/utils/terminal-commands.ts:892`<br>`frontend/src/components/map/CartographersDesk.ts:368`<br>`frontend/src/components/locations/LocationsView.ts:247` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/heartbeat/entries` | `frontend/src/services/api/HeartbeatApiService.ts:37` `HeartbeatApiService.listEntries` | `frontend/src/utils/terminal-commands.ts:252`<br>`frontend/src/utils/terminal-commands.ts:502`<br>`frontend/src/components/terminal/BureauTerminal.ts:774`<br>`frontend/src/components/heartbeat/SimulationPulse.ts:871`<br>`frontend/src/components/heartbeat/SimulationPulse.ts:1267`<br>`frontend/src/components/locations/LocationsView.ts:266` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/cities` | `frontend/src/services/api/LocationsApiService.ts:12` `LocationsApiService.listCities` | `frontend/src/components/locations/LocationsView.ts:168` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/cities/{city_id}` | `frontend/src/services/api/LocationsApiService.ts:20` `LocationsApiService.getCity` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/streets` | `frontend/src/services/api/LocationsApiService.ts:72` `LocationsApiService.listStreets` | `frontend/src/components/locations/LocationsView.ts:226` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/zones` | `frontend/src/services/api/LocationsApiService.ts:42` `LocationsApiService.listZones` | `frontend/src/utils/terminal-initialization.ts:20`<br>`frontend/src/components/epoch/DeployOperativeModal.ts:256`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1748`<br>`frontend/src/components/lore/VelgDossierPreview.ts:178`<br>`frontend/src/components/locations/LocationsView.ts:200` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/locations/zones/{zone_id}` | `frontend/src/services/api/LocationsApiService.ts:50` `LocationsApiService.getZone` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/lore` | `frontend/src/services/api/ForgeApiService.ts:279` `ForgeApiService.getSimulationLore` | `frontend/src/components/lore/lore-content.ts:15` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/lore/by-slug/{slug}` | `frontend/src/services/api/LoreApiService.ts:19` `LoreApiService.getBySlug` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/map` | `frontend/src/services/api/WorldMapApiService.ts:17` `WorldMapApiService.getMap` | `frontend/src/components/world-map/SimulationWorldMap.ts:364`<br>`frontend/src/components/world-map/SimulationWorldMap.ts:596` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/relationships` | `frontend/src/services/api/RelationshipsApiService.ts:21` `RelationshipsApiService.listForSimulation` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/settings` | `frontend/src/services/api/SettingsApiService.ts:20` `SettingsApiService.list` | `frontend/src/app-shell.ts:1141`<br>`frontend/src/app-shell.ts:1142`<br>`frontend/src/components/settings/DesignSettingsPanel.ts:669`<br>`frontend/src/components/settings/AccessSettingsPanel.ts:501`<br>`frontend/src/components/settings/IntegrationSettingsPanel.ts:177`<br>`frontend/src/components/shared/BaseSettingsPanel.ts:81` |  |
| GET | `/api/v1/public/simulations/{simulation_id}/social-media` | `frontend/src/services/api/SocialMediaApiService.ts:26` `SocialMediaApiService.listPosts` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/social-trends` | `frontend/src/services/api/SocialTrendsApiService.ts:17` `SocialTrendsApiService.list` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/public/simulations/{simulation_id}/taxonomies` | `frontend/src/services/api/TaxonomiesApiService.ts:10` `TaxonomiesApiService.list` | `frontend/src/app-shell.ts:1140`<br>`frontend/src/components/settings/WorldSettingsPanel.ts:344` |  |
| GET | `/api/v1/resonances` | `frontend/src/services/api/ResonanceApiService.ts:18` `ResonanceApiService.list` | `frontend/src/components/platform/SimulationsDashboard.ts:1550`<br>`frontend/src/components/admin/AdminResonancesTab.ts:643` |  |
| POST | `/api/v1/resonances` | `frontend/src/services/api/ResonanceApiService.ts:40` `ResonanceApiService.create` | `frontend/src/components/admin/AdminResonancesTab.ts:835`<br>`frontend/src/components/social/SocialTrendsView.ts:1290` |  |
| DELETE | `/api/v1/resonances/{resonance_id}` | `frontend/src/services/api/ResonanceApiService.ts:92` `ResonanceApiService.remove` | `frontend/src/components/admin/AdminResonancesTab.ts:787` |  |
| GET | `/api/v1/resonances/{resonance_id}` | `frontend/src/services/api/ResonanceApiService.ts:25` `ResonanceApiService.getById` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/resonances/{resonance_id}` | `frontend/src/services/api/ResonanceApiService.ts:47` `ResonanceApiService.update` | `frontend/src/components/admin/AdminResonancesTab.ts:834` |  |
| GET | `/api/v1/resonances/{resonance_id}/impacts` | `frontend/src/services/api/ResonanceApiService.ts:71` `ResonanceApiService.listImpacts` | `frontend/src/components/admin/AdminResonancesTab.ts:662`<br>`frontend/src/components/resonance/ResonanceCard.ts:843`<br>`frontend/src/components/resonance/ResonanceDetailsPanel.ts:711` |  |
| POST | `/api/v1/resonances/{resonance_id}/process-impact` | `frontend/src/services/api/ResonanceApiService.ts:61` `ResonanceApiService.processImpact` | `frontend/src/components/admin/AdminResonancesTab.ts:756` |  |
| POST | `/api/v1/resonances/{resonance_id}/restore` | `frontend/src/services/api/ResonanceApiService.ts:85` `ResonanceApiService.restore` | `frontend/src/components/admin/AdminResonancesTab.ts:805` |  |
| PUT | `/api/v1/resonances/{resonance_id}/status` | `frontend/src/services/api/ResonanceApiService.ts:78` `ResonanceApiService.updateStatus` | `frontend/src/components/admin/AdminResonancesTab.ts:729` |  |
| GET | `/api/v1/simulations` | `frontend/src/services/api/SimulationsApiService.ts:18` `SimulationsApiService.list` | `frontend/src/app-shell.ts:1030`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1520`<br>`frontend/src/components/layout/SimulationShell.ts:456`<br>`frontend/src/components/layout/SimulationShell.ts:458`<br>`frontend/src/components/platform/SimulationsDashboard.ts:1512`<br>`frontend/src/components/dungeon/DungeonEntryCta.ts:135`<br>(+2 more) |  |
| POST | `/api/v1/simulations` | `frontend/src/services/api/SimulationsApiService.ts:33` `SimulationsApiService.create` | `frontend/src/components/platform/CreateSimulationWizard.ts:422` |  |
| DELETE | `/api/v1/simulations/{simulation_id}` | `frontend/src/services/api/SimulationsApiService.ts:41` `SimulationsApiService.remove` | `frontend/src/components/settings/GeneralSettingsPanel.ts:275` |  |
| GET | `/api/v1/simulations/{simulation_id}` | `frontend/src/services/api/SimulationsApiService.ts:25` `SimulationsApiService.getById` | `frontend/src/app-shell.ts:1086`<br>`frontend/src/components/settings/GeneralSettingsPanel.ts:160` |  |
| PUT | `/api/v1/simulations/{simulation_id}` | `frontend/src/services/api/SimulationsApiService.ts:37` `SimulationsApiService.update` | `frontend/src/components/settings/GeneralSettingsPanel.ts:213` |  |
| GET | `/api/v1/simulations/{simulation_id}/activities` | `frontend/src/services/api/AgentAutonomyApiService.ts:186` `AgentAutonomyApiService.listActivities` | `frontend/src/components/heartbeat/AgentLifeTimeline.ts:675` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents` | `AgentsApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:219`<br>`frontend/src/utils/terminal-commands.ts:759`<br>`frontend/src/components/buildings/EmbassyCreateModal.ts:301`<br>`frontend/src/components/chat/AgentSelector.ts:285`<br>`frontend/src/components/epoch/DeployOperativeModal.ts:218`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2405`<br>(+4 more) |  |
| POST | `/api/v1/simulations/{simulation_id}/agents` | `AgentsApiService.create` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/agents/AgentEditModal.ts:350` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/agents/{agent_id}` | `AgentsApiService.remove` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/agents/AgentsView.ts:413` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}` | `AgentsApiService.getById` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:394`<br>`frontend/src/components/chat/ChatWindow.ts:872` |  |
| PUT | `/api/v1/simulations/{simulation_id}/agents/{agent_id}` | `AgentsApiService.update` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/agents/AgentEditModal.ts:349` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/aptitudes` | `frontend/src/services/api/AgentsApiService.ts:41` `AgentsApiService.getAptitudes` | `frontend/src/components/agents/AgentDetailsPanel.ts:804` |  |
| PUT | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/aptitudes` | `frontend/src/services/api/AgentsApiService.ts:49` `AgentsApiService.setAptitudes` | `frontend/src/components/agents/AgentDetailsPanel.ts:840` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories` | `frontend/src/services/api/AgentMemoryApiService.ts:15` `AgentMemoryApiService.list` | `frontend/src/components/agents/AgentMemorySection.ts:306` |  |
| POST | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories/reflect` | `frontend/src/services/api/AgentMemoryApiService.ts:27` `AgentMemoryApiService.reflect` | `frontend/src/components/agents/AgentMemorySection.ts:332` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/mood` | `frontend/src/services/api/AgentAutonomyApiService.ts:138` `AgentAutonomyApiService.getAgentMood` | `frontend/src/utils/terminal-commands.ts:395`<br>`frontend/src/components/chat/ChatWindow.ts:492`<br>`frontend/src/components/agents/AgentMoodPanel.ts:813` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/moodlets` | `frontend/src/services/api/AgentAutonomyApiService.ts:142` `AgentAutonomyApiService.getAgentMoodlets` | `frontend/src/utils/terminal-commands.ts:397`<br>`frontend/src/components/agents/AgentMoodPanel.ts:814` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/needs` | `frontend/src/services/api/AgentAutonomyApiService.ts:148` `AgentAutonomyApiService.getAgentNeeds` | `frontend/src/utils/terminal-commands.ts:396`<br>`frontend/src/components/agents/AgentMoodPanel.ts:815` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/opinion-modifiers` | `frontend/src/services/api/AgentAutonomyApiService.ts:164` `AgentAutonomyApiService.getOpinionModifiers` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/opinions` | `frontend/src/services/api/AgentAutonomyApiService.ts:154` `AgentAutonomyApiService.getAgentOpinions` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/reactions` | `frontend/src/services/api/AgentsApiService.ts:25` `AgentsApiService.getReactions` | `frontend/src/components/agents/AgentDetailsPanel.ts:683` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/reactions/{reaction_id}` | `frontend/src/services/api/AgentsApiService.ts:33` `AgentsApiService.deleteReaction` | `frontend/src/components/agents/AgentDetailsPanel.ts:1276` |  |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/relationships` | `frontend/src/services/api/RelationshipsApiService.ts:10` `RelationshipsApiService.listForAgent` | `frontend/src/components/agents/AgentDetailsPanel.ts:701` |  |
| POST | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/relationships` | `frontend/src/services/api/RelationshipsApiService.ts:35` `RelationshipsApiService.create` | `frontend/src/components/agents/AgentDetailsPanel.ts:979`<br>`frontend/src/components/agents/RelationshipEditModal.ts:222` |  |
| GET | `/api/v1/simulations/{simulation_id}/aptitudes` | `frontend/src/services/api/AgentsApiService.ts:56` `AgentsApiService.getAllAptitudes` | `frontend/src/components/landing/LandingAgentShowcase.ts:503`<br>`frontend/src/components/epoch/DeployOperativeModal.ts:219`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:2406`<br>`frontend/src/components/agents/AgentsView.ts:313`<br>`frontend/src/services/DungeonStateManager.ts:505` |  |
| GET | `/api/v1/simulations/{simulation_id}/attunements` | `frontend/src/services/api/HeartbeatApiService.ts:77` `HeartbeatApiService.listAttunements` | `frontend/src/components/health/SimulationHealthView.ts:847` |  |
| POST | `/api/v1/simulations/{simulation_id}/attunements` | `frontend/src/services/api/HeartbeatApiService.ts:84` `HeartbeatApiService.setAttunement` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/attunements/{signature}` | `frontend/src/services/api/HeartbeatApiService.ts:91` `HeartbeatApiService.removeAttunement` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/briefing` | `frontend/src/services/api/AgentAutonomyApiService.ts:200` `AgentAutonomyApiService.getMorningBriefing` | `frontend/src/components/heartbeat/AutonomyBriefingSection.ts:276` |  |
| GET | `/api/v1/simulations/{simulation_id}/broadsheets` | `frontend/src/services/api/BroadsheetApiService.ts:16` `BroadsheetApiService.list` | `frontend/src/components/broadsheet/SimulationBroadsheet.ts:292` |  |
| POST | `/api/v1/simulations/{simulation_id}/broadsheets` | `frontend/src/services/api/BroadsheetApiService.ts:38` `BroadsheetApiService.generate` | `frontend/src/components/broadsheet/SimulationBroadsheet.ts:443` |  |
| GET | `/api/v1/simulations/{simulation_id}/broadsheets/latest` | `frontend/src/services/api/BroadsheetApiService.ts:23` `BroadsheetApiService.getLatest` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/broadsheets/{broadsheet_id}` | `frontend/src/services/api/BroadsheetApiService.ts:31` `BroadsheetApiService.getOne` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/buildings` | `BuildingsApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:228`<br>`frontend/src/components/buildings/BuildingsView.ts:73`<br>`frontend/src/components/shared/VelgStyleReferenceModal.ts:165` |  |
| POST | `/api/v1/simulations/{simulation_id}/buildings` | `BuildingsApiService.create` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/buildings/BuildingEditModal.ts:284` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/buildings/{building_id}` | `BuildingsApiService.remove` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/buildings/BuildingsView.ts:232` |  |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}` | `BuildingsApiService.getById` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/simulations/{simulation_id}/buildings/{building_id}` | `BuildingsApiService.update` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/buildings/BuildingEditModal.ts:282` |  |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/agents` | `frontend/src/services/api/BuildingsApiService.ts:27` `BuildingsApiService.getAgents` | `frontend/src/utils/terminal-commands.ts:418`<br>`frontend/src/components/buildings/BuildingDetailsPanel.ts:388` |  |
| POST | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/assign-agent` | `frontend/src/services/api/BuildingsApiService.ts:38` `BuildingsApiService.assignAgent` | `frontend/src/utils/terminal-commands.ts:777` |  |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/embassy` | `frontend/src/services/api/EmbassiesApiService.ts:26` `EmbassiesApiService.getForBuilding` | `frontend/src/components/buildings/BuildingDetailsPanel.ts:406` |  |
| GET | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/profession-requirements` | `frontend/src/services/api/BuildingsApiService.ts:55` `BuildingsApiService.getProfessionRequirements` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/profession-requirements` | `frontend/src/services/api/BuildingsApiService.ts:68` `BuildingsApiService.setProfessionRequirement` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/buildings/{building_id}/unassign-agent` | `frontend/src/services/api/BuildingsApiService.ts:46` `BuildingsApiService.unassignAgent` | `frontend/src/utils/terminal-commands.ts:808` |  |
| GET | `/api/v1/simulations/{simulation_id}/campaigns` | `CampaignsApiService.list` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/campaigns` | `CampaignsApiService.create` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}` | `CampaignsApiService.remove` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}` | `CampaignsApiService.getById` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}` | `CampaignsApiService.update` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/analytics` | `frontend/src/services/api/CampaignsApiService.ts:34` `CampaignsApiService.getAnalytics` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/events` | `frontend/src/services/api/CampaignsApiService.ts:14` `CampaignsApiService.getEvents` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/events` | `frontend/src/services/api/CampaignsApiService.ts:22` `CampaignsApiService.addEvent` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/campaigns/{campaign_id}/metrics` | `frontend/src/services/api/CampaignsApiService.ts:26` `CampaignsApiService.getMetrics` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations` | `frontend/src/services/api/ChatApiService.ts:15` `ChatApiService.listConversations` | `frontend/src/components/chat/ChatView.ts:232` |  |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations` | `frontend/src/services/api/ChatApiService.ts:22` `ChatApiService.createConversation` | `frontend/src/utils/terminal-commands.ts:459`<br>`frontend/src/utils/terminal-commands.ts:850`<br>`frontend/src/components/chat/ChatView.ts:366` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}` | `frontend/src/services/api/ChatApiService.ts:141` `ChatApiService.deleteConversation` | `frontend/src/components/chat/ChatView.ts:325` |  |
| PATCH | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}` | `frontend/src/services/api/ChatApiService.ts:132` `ChatApiService.archiveConversation` | `frontend/src/components/chat/ChatView.ts:257` |  |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/agents` | `frontend/src/services/api/ChatApiService.ts:54` `ChatApiService.addAgent` | `frontend/src/components/chat/ChatView.ts:402` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/agents/{agent_id}` | `frontend/src/services/api/ChatApiService.ts:64` `ChatApiService.removeAgent` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/events` | `frontend/src/services/api/ChatApiService.ts:93` `ChatApiService.getEventReferences` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/events` | `frontend/src/services/api/ChatApiService.ts:74` `ChatApiService.addEventReference` | `frontend/src/components/chat/ChatView.ts:446` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/events/{event_id}` | `frontend/src/services/api/ChatApiService.ts:84` `ChatApiService.removeEventReference` | `frontend/src/components/chat/ChatView.ts:473` |  |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages` | `frontend/src/services/api/ChatApiService.ts:31` `ChatApiService.getMessages` | `frontend/src/components/chat/ChatWindow.ts:536`<br>`frontend/src/components/chat/ChatWindow.ts:771` |  |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages` | `frontend/src/services/api/ChatApiService.ts:43` `ChatApiService.sendMessage` | `frontend/src/utils/terminal-commands.ts:480`<br>`frontend/src/utils/terminal-commands.ts:871`<br>`frontend/src/components/chat/ChatWindow.ts:637` |  |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages/stream` | `frontend/src/services/chat/ChatStreamConsumer.ts:46` `streamChatResponse` | `frontend/src/services/chat/ChatStreamConsumer.ts:46 (direct SSE consumer)` |  |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages/{message_id}/reactions` | `frontend/src/services/api/ChatApiService.ts:113` `ChatApiService.getReactions` | `frontend/src/components/chat/ChatWindow.ts:517`<br>`frontend/src/components/chat/ChatWindow.ts:858` |  |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages/{message_id}/reactions` | `frontend/src/services/api/ChatApiService.ts:102` `ChatApiService.toggleReaction` | `frontend/src/components/chat/ChatWindow.ts:845` |  |
| POST | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/regenerate` | `frontend/src/services/chat/ChatStreamConsumer.ts:70` `streamRegenerate` | `frontend/src/services/chat/ChatStreamConsumer.ts:70 (direct SSE consumer)` |  |
| GET | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/starters` | `frontend/src/services/api/ChatApiService.ts:150` `ChatApiService.getStarters` | `frontend/src/components/chat/ChatWindow.ts:474` |  |
| PUT | `/api/v1/simulations/{simulation_id}/chat/conversations/{conversation_id}/title` | `frontend/src/services/api/ChatApiService.ts:123` `ChatApiService.renameConversation` | `frontend/src/components/chat/ChatView.ts:286` |  |
| GET | `/api/v1/simulations/{simulation_id}/chronicles` | `frontend/src/services/api/ChronicleApiService.ts:21` `ChronicleApiService.list` | `frontend/src/components/chronicle/ChronicleView.ts:555` |  |
| POST | `/api/v1/simulations/{simulation_id}/chronicles` | `frontend/src/services/api/ChronicleApiService.ts:36` `ChronicleApiService.generate` | `frontend/src/components/chronicle/ChronicleView.ts:667` |  |
| GET | `/api/v1/simulations/{simulation_id}/chronicles/{chronicle_id}` | `frontend/src/services/api/ChronicleApiService.ts:29` `ChronicleApiService.getOne` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/echoes` | `frontend/src/services/api/EchoesApiService.ts:10` `EchoesApiService.listForSimulation` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/echoes` | `frontend/src/services/api/EchoesApiService.ts:30` `EchoesApiService.triggerEcho` | `frontend/src/components/events/EchoTriggerModal.ts:243` |  |
| PATCH | `/api/v1/simulations/{simulation_id}/echoes/{echo_id}/approve` | `frontend/src/services/api/EchoesApiService.ts:34` `EchoesApiService.approve` | **NONE FOUND** | dead client — path matches, zero callers |
| PATCH | `/api/v1/simulations/{simulation_id}/echoes/{echo_id}/reject` | `frontend/src/services/api/EchoesApiService.ts:38` `EchoesApiService.reject` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/embassies` | `frontend/src/services/api/EmbassiesApiService.ts:10` `EmbassiesApiService.listForSimulation` | `frontend/src/components/epoch/DeployOperativeModal.ts:238`<br>`frontend/src/components/agents/AgentDetailsPanel.ts:766`<br>`frontend/src/components/social/SocialTrendsView.ts:1004` |  |
| POST | `/api/v1/simulations/{simulation_id}/embassies` | `frontend/src/services/api/EmbassiesApiService.ts:47` `EmbassiesApiService.create` | `frontend/src/components/buildings/EmbassyCreateModal.ts:403` |  |
| GET | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}` | `frontend/src/services/api/EmbassiesApiService.ts:18` `EmbassiesApiService.getById` | **NONE FOUND** | dead client — path matches, zero callers |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}` | `frontend/src/services/api/EmbassiesApiService.ts:61` `EmbassiesApiService.update` | **NONE FOUND** | dead client — path matches, zero callers |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/activate` | `frontend/src/services/api/EmbassiesApiService.ts:65` `EmbassiesApiService.activate` | **NONE FOUND** | dead client — path matches, zero callers |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/dissolve` | `frontend/src/services/api/EmbassiesApiService.ts:73` `EmbassiesApiService.dissolve` | **NONE FOUND** | dead client — path matches, zero callers |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/suspend` | `frontend/src/services/api/EmbassiesApiService.ts:69` `EmbassiesApiService.suspend` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/events` | `EventsApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:251`<br>`frontend/src/utils/terminal-commands.ts:917`<br>`frontend/src/components/chat/EventPicker.ts:221`<br>`frontend/src/components/social/SocialTrendsView.ts:1053`<br>`frontend/src/components/events/EventsView.ts:96`<br>`frontend/src/components/events/EventsView.ts:258` |  |
| POST | `/api/v1/simulations/{simulation_id}/events` | `EventsApiService.create` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/events/EventEditModal.ts:270` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}` | `EventsApiService.remove` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/events/EventsView.ts:215` |  |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}` | `EventsApiService.getById` (inherited from `CrudApiService`, no fixed line) | `frontend/src/utils/terminal-commands.ts:937`<br>`frontend/src/components/events/EventsView.ts:127` |  |
| PUT | `/api/v1/simulations/{simulation_id}/events/{event_id}` | `EventsApiService.update` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/events/EventEditModal.ts:269` |  |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/chains` | `frontend/src/services/api/EventsApiService.ts:56` `EventsApiService.getChains` | `frontend/src/components/events/EventDetailsPanel.ts:727` |  |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/chains` | `frontend/src/services/api/EventsApiService.ts:64` `EventsApiService.createChain` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}/chains/{chain_id}` | `frontend/src/services/api/EventsApiService.ts:68` `EventsApiService.deleteChain` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/echoes` | `frontend/src/services/api/EchoesApiService.ts:18` `EchoesApiService.listForEvent` | `frontend/src/components/events/EventDetailsPanel.ts:827` |  |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/generate-reactions` | `frontend/src/services/api/EventsApiService.ts:39` `EventsApiService.generateReactions` | `frontend/src/components/events/EventDetailsPanel.ts:948` |  |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/reactions` | `frontend/src/services/api/EventsApiService.ts:15` `EventsApiService.getReactions` | `frontend/src/components/events/EventDetailsPanel.ts:709` |  |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/reactions` | `frontend/src/services/api/EventsApiService.ts:23` `EventsApiService.addReaction` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}/reactions/{reaction_id}` | `frontend/src/services/api/EventsApiService.ts:31` `EventsApiService.deleteReaction` | `frontend/src/components/events/EventDetailsPanel.ts:924` |  |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/responses` | `frontend/src/services/api/HeartbeatApiService.ts:55` `HeartbeatApiService.listResponses` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/events/{event_id}/responses` | `frontend/src/services/api/HeartbeatApiService.ts:63` `HeartbeatApiService.createResponse` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/events/{event_id}/responses/{response_id}` | `frontend/src/services/api/HeartbeatApiService.ts:71` `HeartbeatApiService.cancelResponse` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/simulations/{simulation_id}/events/{event_id}/status` | `frontend/src/services/api/EventsApiService.ts:50` `EventsApiService.updateStatus` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/events/{event_id}/zone-links` | `frontend/src/services/api/EventsApiService.ts:72` `EventsApiService.getZoneLinks` | `frontend/src/components/events/EventDetailsPanel.ts:775` |  |
| POST | `/api/v1/simulations/{simulation_id}/generate/agent` | `frontend/src/services/api/GenerationApiService.ts:42` `GenerationApiService.generateAgent` | `frontend/src/components/agents/AgentEditModal.ts:202` |  |
| POST | `/api/v1/simulations/{simulation_id}/generate/building` | `frontend/src/services/api/GenerationApiService.ts:49` `GenerationApiService.generateBuilding` | `frontend/src/components/buildings/BuildingEditModal.ts:177` |  |
| POST | `/api/v1/simulations/{simulation_id}/generate/event` | `frontend/src/services/api/GenerationApiService.ts:63` `GenerationApiService.generateEvent` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/generate/image` | `frontend/src/services/api/GenerationApiService.ts:70` `GenerationApiService.generateImage` | `frontend/src/components/buildings/BuildingEditModal.ts:228`<br>`frontend/src/components/agents/AgentEditModal.ts:300` |  |
| POST | `/api/v1/simulations/{simulation_id}/generate/portrait-description` | `frontend/src/services/api/GenerationApiService.ts:56` `GenerationApiService.generatePortraitDescription` | `frontend/src/components/agents/AgentEditModal.ts:252` |  |
| POST | `/api/v1/simulations/{simulation_id}/generate/relationships` | `frontend/src/services/api/GenerationApiService.ts:77` `GenerationApiService.generateRelationships` | `frontend/src/components/agents/AgentDetailsPanel.ts:936` |  |
| GET | `/api/v1/simulations/{simulation_id}/health` | `frontend/src/services/api/HealthApiService.ts:15` `HealthApiService.getDashboard` | `frontend/src/utils/terminal-commands.ts:515`<br>`frontend/src/components/health/DesperateActionsPanel.ts:395`<br>`frontend/src/components/health/SimulationHealthView.ts:846`<br>`frontend/src/components/social/SocialTrendsView.ts:1005` |  |
| GET | `/api/v1/simulations/{simulation_id}/health/buildings` | `frontend/src/services/api/HealthApiService.ts:23` `HealthApiService.listBuildingReadiness` | `frontend/src/utils/terminal-commands.ts:253`<br>`frontend/src/utils/terminal-commands.ts:417`<br>`frontend/src/components/buildings/BuildingDetailsPanel.ts:422` |  |
| POST | `/api/v1/simulations/{simulation_id}/health/refresh` | `frontend/src/services/api/HealthApiService.ts:47` `HealthApiService.refreshMetrics` | `frontend/src/components/health/SimulationHealthView.ts:879` |  |
| GET | `/api/v1/simulations/{simulation_id}/health/zones` | `frontend/src/services/api/HealthApiService.ts:30` `HealthApiService.listZoneStability` | `frontend/src/utils/terminal-commands.ts:250`<br>`frontend/src/utils/terminal-commands.ts:602`<br>`frontend/src/utils/terminal-commands.ts:892`<br>`frontend/src/components/map/CartographersDesk.ts:368`<br>`frontend/src/components/locations/LocationsView.ts:247` |  |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat` | `frontend/src/services/api/HeartbeatApiService.ts:22` `HeartbeatApiService.getOverview` | `frontend/src/components/heartbeat/SimulationPulse.ts:870` |  |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat/arcs` | `frontend/src/services/api/HeartbeatApiService.ts:45` `HeartbeatApiService.listArcs` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat/briefing` | `frontend/src/services/api/HeartbeatApiService.ts:29` `HeartbeatApiService.getDailyBriefing` | `frontend/src/components/layout/SimulationShell.ts:473` |  |
| GET | `/api/v1/simulations/{simulation_id}/heartbeat/entries` | `frontend/src/services/api/HeartbeatApiService.ts:37` `HeartbeatApiService.listEntries` | `frontend/src/utils/terminal-commands.ts:252`<br>`frontend/src/utils/terminal-commands.ts:502`<br>`frontend/src/components/terminal/BureauTerminal.ts:774`<br>`frontend/src/components/heartbeat/SimulationPulse.ts:871`<br>`frontend/src/components/heartbeat/SimulationPulse.ts:1267`<br>`frontend/src/components/locations/LocationsView.ts:266` |  |
| GET | `/api/v1/simulations/{simulation_id}/invitations` | `frontend/src/services/api/InvitationsApiService.ts:18` `InvitationsApiService.list` | `frontend/src/components/settings/AccessSettingsPanel.ts:652` |  |
| POST | `/api/v1/simulations/{simulation_id}/invitations` | `frontend/src/services/api/InvitationsApiService.ts:14` `InvitationsApiService.create` | `frontend/src/components/settings/AccessSettingsPanel.ts:715` |  |
| GET | `/api/v1/simulations/{simulation_id}/locations/cities` | `frontend/src/services/api/LocationsApiService.ts:12` `LocationsApiService.listCities` | `frontend/src/components/locations/LocationsView.ts:168` |  |
| POST | `/api/v1/simulations/{simulation_id}/locations/cities` | `frontend/src/services/api/LocationsApiService.ts:24` `LocationsApiService.createCity` | `frontend/src/components/locations/LocationEditModal.ts:91` |  |
| GET | `/api/v1/simulations/{simulation_id}/locations/cities/{city_id}` | `frontend/src/services/api/LocationsApiService.ts:20` `LocationsApiService.getCity` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/simulations/{simulation_id}/locations/cities/{city_id}` | `frontend/src/services/api/LocationsApiService.ts:32` `LocationsApiService.updateCity` | `frontend/src/components/locations/LocationEditModal.ts:89` |  |
| GET | `/api/v1/simulations/{simulation_id}/locations/streets` | `frontend/src/services/api/LocationsApiService.ts:72` `LocationsApiService.listStreets` | `frontend/src/components/locations/LocationsView.ts:226` |  |
| POST | `/api/v1/simulations/{simulation_id}/locations/streets` | `frontend/src/services/api/LocationsApiService.ts:76` `LocationsApiService.createStreet` | `frontend/src/components/locations/LocationEditModal.ts:115` |  |
| PUT | `/api/v1/simulations/{simulation_id}/locations/streets/{street_id}` | `frontend/src/services/api/LocationsApiService.ts:84` `LocationsApiService.updateStreet` | `frontend/src/components/locations/LocationEditModal.ts:113` |  |
| GET | `/api/v1/simulations/{simulation_id}/locations/zones` | `frontend/src/services/api/LocationsApiService.ts:42` `LocationsApiService.listZones` | `frontend/src/utils/terminal-initialization.ts:20`<br>`frontend/src/components/epoch/DeployOperativeModal.ts:256`<br>`frontend/src/components/epoch/EpochCommandCenter.ts:1748`<br>`frontend/src/components/lore/VelgDossierPreview.ts:178`<br>`frontend/src/components/locations/LocationsView.ts:200` |  |
| POST | `/api/v1/simulations/{simulation_id}/locations/zones` | `frontend/src/services/api/LocationsApiService.ts:54` `LocationsApiService.createZone` | `frontend/src/components/locations/LocationEditModal.ts:103` |  |
| GET | `/api/v1/simulations/{simulation_id}/locations/zones/{zone_id}` | `frontend/src/services/api/LocationsApiService.ts:50` `LocationsApiService.getZone` | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/simulations/{simulation_id}/locations/zones/{zone_id}` | `frontend/src/services/api/LocationsApiService.ts:62` `LocationsApiService.updateZone` | `frontend/src/components/locations/LocationEditModal.ts:101` |  |
| POST | `/api/v1/simulations/{simulation_id}/lore` | `frontend/src/services/api/LoreApiService.ts:26` `LoreApiService.createSection` | `frontend/src/components/lore/SimulationLoreView.ts:228` |  |
| PUT | `/api/v1/simulations/{simulation_id}/lore` | `frontend/src/services/api/LoreApiService.ts:45` `LoreApiService.reorderSections` | `frontend/src/components/lore/SimulationLoreView.ts:271` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/lore/{section_id}` | `frontend/src/services/api/LoreApiService.ts:38` `LoreApiService.deleteSection` | `frontend/src/components/lore/SimulationLoreView.ts:247` |  |
| PATCH | `/api/v1/simulations/{simulation_id}/lore/{section_id}` | `frontend/src/services/api/LoreApiService.ts:34` `LoreApiService.updateSection` | `frontend/src/components/lore/SimulationLoreView.ts:216` |  |
| GET | `/api/v1/simulations/{simulation_id}/members` | `frontend/src/services/api/MembersApiService.ts:6` `MembersApiService.list` | `frontend/src/app-shell.ts:984`<br>`frontend/src/components/settings/AccessSettingsPanel.ts:636` |  |
| POST | `/api/v1/simulations/{simulation_id}/members` | `frontend/src/services/api/MembersApiService.ts:13` `MembersApiService.add` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/members/{member_id}` | `frontend/src/services/api/MembersApiService.ts:25` `MembersApiService.remove` | `frontend/src/components/settings/AccessSettingsPanel.ts:693` |  |
| PUT | `/api/v1/simulations/{simulation_id}/members/{member_id}` | `frontend/src/services/api/MembersApiService.ts:21` `MembersApiService.changeRole` | `frontend/src/components/settings/AccessSettingsPanel.ts:665` |  |
| GET | `/api/v1/simulations/{simulation_id}/mood-summary` | `frontend/src/services/api/AgentAutonomyApiService.ts:192` `AgentAutonomyApiService.getMoodSummary` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/prompt-templates` | `PromptTemplatesApiService.list` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/settings/PromptsSettingsPanel.ts:278` |  |
| POST | `/api/v1/simulations/{simulation_id}/prompt-templates` | `PromptTemplatesApiService.create` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/settings/PromptsSettingsPanel.ts:364` |  |
| POST | `/api/v1/simulations/{simulation_id}/prompt-templates/test` | `frontend/src/services/api/PromptTemplatesApiService.ts:11` `PromptTemplatesApiService.test` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/prompt-templates/{template_id}` | `PromptTemplatesApiService.remove` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/settings/PromptsSettingsPanel.ts:396` |  |
| GET | `/api/v1/simulations/{simulation_id}/prompt-templates/{template_id}` | `PromptTemplatesApiService.getById` (inherited from `CrudApiService`, no fixed line) | **NONE FOUND** | dead client — path matches, zero callers |
| PUT | `/api/v1/simulations/{simulation_id}/prompt-templates/{template_id}` | `PromptTemplatesApiService.update` (inherited from `CrudApiService`, no fixed line) | `frontend/src/components/settings/PromptsSettingsPanel.ts:363` |  |
| GET | `/api/v1/simulations/{simulation_id}/relationships` | `frontend/src/services/api/RelationshipsApiService.ts:21` `RelationshipsApiService.listForSimulation` | **NONE FOUND** | dead client — path matches, zero callers |
| DELETE | `/api/v1/simulations/{simulation_id}/relationships/{relationship_id}` | `frontend/src/services/api/RelationshipsApiService.ts:52` `RelationshipsApiService.remove` | `frontend/src/components/agents/AgentDetailsPanel.ts:907` |  |
| PATCH | `/api/v1/simulations/{simulation_id}/relationships/{relationship_id}` | `frontend/src/services/api/RelationshipsApiService.ts:48` `RelationshipsApiService.update` | `frontend/src/components/agents/RelationshipEditModal.ts:212` |  |
| GET | `/api/v1/simulations/{simulation_id}/settings` | `frontend/src/services/api/SettingsApiService.ts:25` `SettingsApiService.list` | `frontend/src/app-shell.ts:1141`<br>`frontend/src/app-shell.ts:1142`<br>`frontend/src/components/settings/DesignSettingsPanel.ts:669`<br>`frontend/src/components/settings/AccessSettingsPanel.ts:501`<br>`frontend/src/components/settings/IntegrationSettingsPanel.ts:177`<br>`frontend/src/components/shared/BaseSettingsPanel.ts:81` |  |
| POST | `/api/v1/simulations/{simulation_id}/settings` | `frontend/src/services/api/SettingsApiService.ts:54` `SettingsApiService.upsert` | `frontend/src/components/settings/AccessSettingsPanel.ts:607`<br>`frontend/src/components/settings/IntegrationSettingsPanel.ts:250`<br>`frontend/src/components/shared/BaseSettingsPanel.ts:132` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/settings/{setting_id}` | `frontend/src/services/api/SettingsApiService.ts:58` `SettingsApiService.remove` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/settings/{setting_id}` | `frontend/src/services/api/SettingsApiService.ts:47` `SettingsApiService.getById` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/social-media/posts` | `frontend/src/services/api/SocialMediaApiService.ts:27` `SocialMediaApiService.listPosts` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/analyze-sentiment` | `frontend/src/services/api/SocialMediaApiService.ts:47` `SocialMediaApiService.analyzeSentiment` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/comments` | `frontend/src/services/api/SocialMediaApiService.ts:65` `SocialMediaApiService.getComments` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/generate-reactions` | `frontend/src/services/api/SocialMediaApiService.ts:58` `SocialMediaApiService.generateReactions` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/social-media/posts/{post_id}/transform` | `frontend/src/services/api/SocialMediaApiService.ts:39` `SocialMediaApiService.transformPost` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/social-media/sync` | `frontend/src/services/api/SocialMediaApiService.ts:31` `SocialMediaApiService.syncPosts` | **NONE FOUND** | dead client — path matches, zero callers |
| GET | `/api/v1/simulations/{simulation_id}/social-trends` | `frontend/src/services/api/SocialTrendsApiService.ts:17` `SocialTrendsApiService.list` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/batch-integrate` | `frontend/src/services/api/SocialTrendsApiService.ts:172` `SocialTrendsApiService.batchIntegrate` | `frontend/src/components/social/SocialTrendsView.ts:1226` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/batch-transform` | `frontend/src/services/api/SocialTrendsApiService.ts:147` `SocialTrendsApiService.batchTransform` | `frontend/src/components/social/SocialTrendsView.ts:1160` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/browse` | `frontend/src/services/api/SocialTrendsApiService.ts:72` `SocialTrendsApiService.browse` | `frontend/src/components/social/SocialTrendsView.ts:1034` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/fetch` | `frontend/src/services/api/SocialTrendsApiService.ts:24` `SocialTrendsApiService.fetch` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/integrate` | `frontend/src/services/api/SocialTrendsApiService.ts:56` `SocialTrendsApiService.integrate` | `frontend/src/components/social/TransformationModal.ts:660` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/integrate-article` | `frontend/src/services/api/SocialTrendsApiService.ts:113` `SocialTrendsApiService.integrateArticle` | `frontend/src/components/social/TransformationModal.ts:625` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/transform` | `frontend/src/services/api/SocialTrendsApiService.ts:42` `SocialTrendsApiService.transform` | `frontend/src/components/social/TransformationModal.ts:567` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/transform-article` | `frontend/src/services/api/SocialTrendsApiService.ts:97` `SocialTrendsApiService.transformArticle` | `frontend/src/components/social/TransformationModal.ts:560` |  |
| POST | `/api/v1/simulations/{simulation_id}/social-trends/workflow` | `frontend/src/services/api/SocialTrendsApiService.ts:63` `SocialTrendsApiService.workflow` | **NONE FOUND** | dead client — path matches, zero callers |
| POST | `/api/v1/simulations/{simulation_id}/style-references/upload` | `frontend/src/services/api/StyleReferenceApiService.ts:33` `StyleReferenceApiService.upload` | `frontend/src/components/shared/VelgStyleReferenceModal.ts:204` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/style-references/{entity_type}` | `frontend/src/services/api/StyleReferenceApiService.ts:55` `StyleReferenceApiService.remove` | `frontend/src/components/shared/VelgStyleReferencePanel.ts:240` |  |
| GET | `/api/v1/simulations/{simulation_id}/style-references/{entity_type}` | `frontend/src/services/api/StyleReferenceApiService.ts:41` `StyleReferenceApiService.list` | `frontend/src/components/shared/VelgStyleReferencePanel.ts:231`<br>`frontend/src/components/shared/VelgStyleReferencePanel.ts:232` |  |
| GET | `/api/v1/simulations/{simulation_id}/taxonomies` | `frontend/src/services/api/TaxonomiesApiService.ts:10` `TaxonomiesApiService.list` | `frontend/src/app-shell.ts:1140`<br>`frontend/src/components/settings/WorldSettingsPanel.ts:344` |  |
| POST | `/api/v1/simulations/{simulation_id}/taxonomies` | `frontend/src/services/api/TaxonomiesApiService.ts:23` `TaxonomiesApiService.create` | `frontend/src/components/settings/WorldSettingsPanel.ts:405` |  |
| PUT | `/api/v1/simulations/{simulation_id}/taxonomies/{taxonomy_id}` | `frontend/src/services/api/TaxonomiesApiService.ts:31` `TaxonomiesApiService.update` | `frontend/src/components/settings/WorldSettingsPanel.ts:433` |  |
| POST | `/api/v1/simulations/{simulation_id}/threshold-actions/{action_type}` | `frontend/src/services/api/HealthApiService.ts:43` `HealthApiService.executeThresholdAction` | `frontend/src/components/health/DesperateActionsPanel.ts:539` |  |
| GET | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions` | `frontend/src/services/api/ZoneActionApiService.ts:10` `ZoneActionApiService.list` | `frontend/src/components/health/SimulationHealthView.ts:1012` |  |
| POST | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions` | `frontend/src/services/api/ZoneActionApiService.ts:18` `ZoneActionApiService.create` | `frontend/src/utils/terminal-commands.ts:694`<br>`frontend/src/utils/terminal-commands.ts:731`<br>`frontend/src/components/health/SimulationHealthView.ts:997` |  |
| DELETE | `/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions/{action_id}` | `frontend/src/services/api/ZoneActionApiService.ts:22` `ZoneActionApiService.cancel` | `frontend/src/components/health/SimulationHealthView.ts:1018` |  |
| GET | `/api/v1/users/me` | `frontend/src/services/api/UsersApiService.ts:6` `UsersApiService.getMe` | `frontend/src/services/supabase/SupabaseAuthService.ts:174` |  |
| GET | `/api/v1/users/me/achievements` | `frontend/src/services/api/AchievementsApiService.ts:49` `AchievementsApiService.getAchievements` | `frontend/src/components/platform/VelgAchievementGrid.ts:191` |  |
| GET | `/api/v1/users/me/achievements/progress` | `frontend/src/services/api/AchievementsApiService.ts:53` `AchievementsApiService.getProgress` | `frontend/src/components/platform/VelgAchievementGrid.ts:192` |  |
| GET | `/api/v1/users/me/achievements/summary` | `frontend/src/services/api/AchievementsApiService.ts:57` `AchievementsApiService.getSummary` | `frontend/src/components/platform/VelgAchievementSummaryCard.ts:264`<br>`frontend/src/components/platform/VelgAchievementSummaryCard.ts:278` |  |
| GET | `/api/v1/users/me/dashboard` | `frontend/src/services/api/UsersApiService.ts:18` `UsersApiService.getDashboard` | `frontend/src/components/platform/SimulationsDashboard.ts:1565` |  |
| GET | `/api/v1/users/me/notification-preferences` | `frontend/src/services/api/NotificationPreferencesApiService.ts:6` `NotificationPreferencesApiServiceImpl.getPreferences` | `frontend/src/components/settings/NotificationsSettingsPanel.ts:103` |  |
| POST | `/api/v1/users/me/notification-preferences` | `frontend/src/services/api/NotificationPreferencesApiService.ts:12` `NotificationPreferencesApiServiceImpl.updatePreferences` | `frontend/src/components/settings/NotificationsSettingsPanel.ts:134` |  |
| PATCH | `/api/v1/users/me/onboarding` | `frontend/src/services/api/UsersApiService.ts:22` `UsersApiService.completeOnboarding` | **NONE FOUND** | dead client — path matches, zero callers |

### ORPHAN-BACKEND (no frontend caller at all) — 39 endpoints

| Method | Path | File:Line | Category | Note |
|---|---|---|---|---|
| GET | `/api/v1/public/operative-types` | `backend/routers/public.py:1034` | DUPLICATE | frontend/src/utils/operative-constants.ts hardcodes the same table client-side; its own header comment says this endpoint 'returns the same data dynamically if needed' — a documented, intentional duplicate, not a forgotten caller. |
| GET | `/api/v1/health` | `backend/routers/health.py:13` | EXTERNAL | Bare infra healthcheck (no auth) for load balancer / uptime monitor (Coolify/Kuma/Beszel per project ops notes), not app UI. |
| POST | `/api/v1/webhooks/github` | `backend/routers/webhooks.py:61` | EXTERNAL | GitHub webhook delivery (HMAC-verified, external); drives content_drafts_service. Not a frontend caller by design. |
| GET | `/robots.txt` | `backend/routers/seo.py:51` | EXTERNAL | Search-engine crawler convention (seo.py); no frontend caller expected. |
| GET | `/sitemap.xml` | `backend/routers/seo.py:56` | EXTERNAL | Search-engine crawler convention (seo.py); no frontend caller expected. |
| GET | `/{settings.indexnow_key}.txt` | `backend/routers/seo.py:195` | EXTERNAL | IndexNow protocol — search engines poll this key file (seo.py); by web convention, no frontend caller expected. |
| POST | `/api/v1/admin/dungeon-showcase/generate-image` | `backend/routers/admin.py:727` | UNUSED | No 'dungeon-showcase' or 'generate-image' admin call anywhere in the frontend. |
| GET | `/api/v1/admin/instagram/stories/{story_id}` | `backend/routers/social_stories.py:109` | UNUSED | AdminApiService wires list/sequence/skip/unskip/compose/publish/settings for stories, but not a single-story getById. |
| POST | `/api/v1/admin/instagram/stories/{story_id}/regenerate` | `backend/routers/social_stories.py:260` | UNUSED | AdminApiService wires skip/unskip/compose/publish but not regenerate. |
| POST | `/api/v1/admin/simulations/{simulation_id}/regenerate-images` | `backend/routers/admin.py:854` | UNUSED | No admin regenerate-images call anywhere in the frontend. |
| POST | `/api/v1/admin/simulations/{simulation_id}/regenerate-lore` | `backend/routers/admin.py:758` | UNUSED | No admin regenerate-lore call anywhere in the frontend (distinct from EpochsApiService's unrelated invitations/regenerate-lore). |
| GET | `/api/v1/bot-players/{bot_id}` | `backend/routers/bot_players.py:32` | UNUSED | BotApiService only lists all presets (listPresets); no single-preset getById. |
| POST | `/api/v1/connections` | `backend/routers/connections.py:34` | UNUSED | same — ConnectionsApiService is read-only. |
| PATCH | `/api/v1/connections/{connection_id}` | `backend/routers/connections.py:56` | UNUSED | same — ConnectionsApiService is read-only. |
| DELETE | `/api/v1/connections/{connection_id}` | `backend/routers/connections.py:80` | UNUSED | ConnectionsApiService has no create/update/delete methods at all (read-only client: listAll/getMapData/getBattleFeed/getBleedGazette). |
| POST | `/api/v1/drift/admin/regenerate` | `backend/routers/drift.py:133` | UNUSED | DriftApiService.ts has no admin-prefixed method at all. |
| GET | `/api/v1/epochs/{epoch_id}/instances` | `backend/routers/epochs.py:259` | UNUSED | No reference to game-instance listing anywhere in EpochsApiService.ts or elsewhere. |
| POST | `/api/v1/forge/admin/regenerate-images/{simulation_id}` | `backend/routers/forge.py:1118` | UNUSED | ForgeApiService's admin section only has getStats and purge. |
| POST | `/api/v1/forge/admin/retrigger-batch/{simulation_id}` | `backend/routers/forge.py:1172` | UNUSED | same — ForgeApiService's admin section only has getStats and purge. |
| GET | `/api/v1/public/bonds` | `backend/routers/public.py:1182` | UNUSED | BondsApiService only calls the member-scoped /api/v1/bonds (mode-agnostic 'base' field); no public variant call exists. |
| GET | `/api/v1/public/health/all` | `backend/routers/public.py:853` | UNUSED | No platform-wide health rollup call anywhere in the frontend. |
| GET | `/api/v1/public/simulations/{simulation_id}/health/embassies` | `backend/routers/public.py:843` | UNUSED | HealthApiService has getDashboard/listBuildingReadiness/listZoneStability/getBleedStatus/refreshMetrics but no embassy-health method (public or member). |
| GET | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions` | `backend/routers/agent_professions.py:28` | UNUSED | Entire agent_professions.py router (4 endpoints) has no frontend caller anywhere; AgentDetailsPanel.ts reads agent.professions as a plain field on the agent object instead. |
| POST | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions` | `backend/routers/agent_professions.py:41` | UNUSED | same — entire professions sub-resource is unused. |
| PUT | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions/{profession_id}` | `backend/routers/agent_professions.py:56` | UNUSED | same — entire professions sub-resource is unused. |
| DELETE | `/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions/{profession_id}` | `backend/routers/agent_professions.py:78` | UNUSED | same — entire professions sub-resource is unused. |
| GET | `/api/v1/simulations/{simulation_id}/buildings/by-zone/{zone_id}` | `backend/routers/buildings.py:224` | UNUSED | BuildingsApiService has no byZone-style method. |
| PATCH | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/ward` | `backend/routers/embassies.py:174` | UNUSED | Ward Mechanic (migration 191) has zero frontend wiring; EmbassiesApiService.ts has no ward-related method at all. |
| DELETE | `/api/v1/simulations/{simulation_id}/embassies/{embassy_id}/ward` | `backend/routers/embassies.py:195` | UNUSED | same — ward mechanic has no UI. |
| GET | `/api/v1/simulations/{simulation_id}/events/by-tags/{tags}` | `backend/routers/events.py:327` | UNUSED | EventsApiService has no by-tags method. |
| POST | `/api/v1/simulations/{simulation_id}/generate/lore-image` | `backend/routers/generation.py:325` | UNUSED | GenerationApiService.generateImage only calls the generic /generate/image; the dedicated lore-image endpoint (editor-gated, 3:2 aspect) has no caller. |
| GET | `/api/v1/simulations/{simulation_id}/health/buildings/{building_id}` | `backend/routers/game_mechanics.py:84` | UNUSED | HealthApiService.listBuildingReadiness only fetches the list, never a single building's detail. |
| GET | `/api/v1/simulations/{simulation_id}/health/embassies` | `backend/routers/game_mechanics.py:130` | UNUSED | no embassy-health method exists (member scope either). |
| GET | `/api/v1/simulations/{simulation_id}/health/simulation` | `backend/routers/game_mechanics.py:47` | UNUSED | redundant with HealthApiService.getDashboard's plain '/health' call; the '/health/simulation' alias is never used. |
| GET | `/api/v1/simulations/{simulation_id}/health/zones/{zone_id}` | `backend/routers/game_mechanics.py:113` | UNUSED | HealthApiService.listZoneStability only fetches the list, never a single zone's detail. |
| GET | `/api/v1/simulations/{simulation_id}/settings/by-category/{category}` | `backend/routers/settings.py:39` | UNUSED | SettingsApiService.getByCategory/list both filter the base /settings list via a query param instead of calling this path. |
| PUT | `/api/v1/simulations/{simulation_id}/settings/{setting_id}` | `backend/routers/settings.py:92` | UNUSED | SettingsApiService.upsert (POST) covers create+update; the PUT-by-id variant is never called. |
| GET | `/api/v1/simulations/{simulation_id}/taxonomies/by-type/{taxonomy_type}` | `backend/routers/taxonomies.py:42` | UNUSED | TaxonomiesApiService.getByType calls the base /taxonomies list with a query param instead of this path. |
| DELETE | `/api/v1/simulations/{simulation_id}/taxonomies/{taxonomy_id}` | `backend/routers/taxonomies.py:104` | UNUSED | TaxonomiesApiService has no remove()/delete method; UI only offers deactivate() (PUT is_active=false, a soft delete). |

## Task 3 — ORPHAN-FRONTEND (frontend calls a path with no matching backend route)

| File:Line | Class.method | Called path | Why it 404s |
|---|---|---|---|
| `frontend/src/services/api/CrudApiService.ts (inherited by CampaignsApiService)` | `CampaignsApiService.getBySlug` | `GET /api/v1/public/simulations/{id}/campaigns/by-slug/{slug}` | Backend has no by-slug route for campaigns (only agents.py and buildings.py register `by-slug/{slug}`, see `public.py` lines 223 and 261). Method is also `protected` (not overridden public), so no component could call it anyway. |
| `frontend/src/services/api/CrudApiService.ts (inherited by EventsApiService)` | `EventsApiService.getBySlug` | `GET /api/v1/public/simulations/{id}/events/by-slug/{slug}` | Same — no backend route; method stays `protected`. |
| `frontend/src/services/api/CrudApiService.ts (inherited by PromptTemplatesApiService)` | `PromptTemplatesApiService.listPublic` | `GET /api/v1/public/simulations/{id}/prompt-templates` | public.py has no public prompt-templates listing at all; method stays `protected`. |
| `frontend/src/services/api/CrudApiService.ts (inherited by PromptTemplatesApiService)` | `PromptTemplatesApiService.getBySlug` | `GET /api/v1/public/simulations/{id}/prompt-templates/by-slug/{slug}` | Same — no backend route; method stays `protected`. |
| `frontend/src/services/api/UsersApiService.ts:9-10` | `UsersApiService.updateMe` | `PUT /api/v1/users/me` | users.py has no PUT/PATCH for the profile itself (only GET /me, PATCH /me/onboarding, GET/POST /me/notification-preferences). **LIVE BUG**: called from `frontend/src/components/platform/UserProfileView.ts:293` on every Save-profile click; always fails. |
| `frontend/src/services/api/UsersApiService.ts:13-14` | `UsersApiService.getMemberships` | `GET /api/v1/users/me/memberships` | No such route anywhere (the only `/memberships` routes are admin-only, `/api/v1/admin/users/{user_id}/memberships`, a different shape/purpose). **LIVE BUG**: called from `frontend/src/components/platform/UserProfileView.ts:270` on every page load; always fails. |


## Task 4 — UI Stubs

Grepped `frontend/src/components` for TODO/FIXME, 'coming soon', 'not implemented', 'placeholder', unconditionally-disabled buttons, `console.warn('not`, empty click handlers, and `msg()` strings that say a feature is unavailable.

Zero `// TODO` / `// FIXME` anywhere in `frontend/src/components` (matches the CLAUDE.md 'No TODO-later patches' rule). Zero `console.warn('not...`. Zero unconditionally-empty click handlers. The 2 hardcoded-`disabled`-button hits (`VelgOrphanSweeperSettingsModal.ts:695`, `VelgSweepOrphansModal.ts:443`) are both loading-state buttons inside an `if (this._running)` / `if (this._state === 'loading')` branch, not stubs. The 252 raw 'placeholder' grep hits are overwhelmingly `placeholder=${msg(...)}` form-field hint text and `::placeholder` / empty-state CSS selectors (spot-checked across admin, agents, forge components) — not feature stubs.

Genuine stubs found:

| File:Line | String / mechanism |
|---|---|
| `frontend/src/components/forge/VelgDarkroomStudio.ts:998` | `msg('Card frame customization coming soon. Texture, nameplate style, corner treatment, and foil effects.')` |
| `frontend/src/components/archetypes/ArchetypeDetailView.ts:1907` | `msg('This archetype detail page is not available yet. Explore the available archetypes below.')` |
| `frontend/src/components/platform/CreateSimulationWizard.ts:588` | `msg('Select specific taxonomy sets to import. (Not yet available)')` |
| `frontend/src/components/admin/AdminForgeTab.ts:806` | `msg('Not yet configurable')` |
| `frontend/src/components/admin/AdminForgeTab.ts:821` | `msg('Not yet configurable')` |
| `frontend/src/components/epoch/EpochCreationWizard.ts:55-57` | Dev comment + type: `/** Backend supports five modes; three are not implemented yet, so the wizard offers only the two that are wired end to end. */ type AutoResolveMode = 'manual' \| 'activity_gated';` — matches the still-open `epoch-auto-resolve-spec.md` item in project memory. |
| `frontend/src/app-shell.ts` `_renderSimulationView()` `default:` branch (~line 1218) | Generic `<div class="placeholder-view">...This view is coming soon.</div>` for any `/simulations/:id/<view>` segment not in the 17-case switch. Currently **unreachable in practice**: `SimulationNav.ts`'s 17 tabs (lore, agents, buildings, broadsheet, chronicle, health, pulse, events, bonds, chat, social, locations, atlas, terminal, dungeon, drift, settings) match the switch's 17 cases exactly — the stub only fires if a user hand-types an unrecognized view segment in the URL. |

Excluded as false positives (flavor/runtime text, not dev stubs): `VelgAttunementPanel.ts:336` ('The way to this attunement is not yet known.' — in-fiction locked-achievement copy), `DungeonCombatFx.ts:719` / `AdminOpsTab.ts:341` / `ForecastPanel.ts:435` (degraded-mode / error-prefix runtime messages), `AdminResonancesTab.ts:903` ('not yet active' inside an explanatory lifecycle sentence), `VelgForgeAstrolabe.ts:1174` (a labeled fallback-mode notice, not a stub), `what-is-the-metaverse.ts:110` (a Deleuze quote containing 'not yet', unrelated).

## Task 5 — Route Inventory (58 SPA routes)

Routes come from the single `Router` config in `frontend/src/app-shell.ts` (`@lit-labs/router`) — there is no separate router file. 'Linked' means the path (or its static prefix, for `:param` routes) was found as an `href=` or `navigate(...)`/`.goto(...)` target somewhere in `frontend/src`; the citing file is given. 'Nav chrome' = `SimulationNav.ts` / `PlatformHeader.ts` / `HeaderCluster.ts` / `UserMenu.ts` / `PlatformFooter.ts` / `SimulationHeader.ts` / `CommandPalette.ts` (persistent, always-available nav surfaces). A route can be linked from ordinary content (a card, a footer link, another feature's detail view) without being in nav chrome — both count as 'linked'; only a route with **no** citation anywhere is UNLINKED.

| Route | Component | Linked? |
|---|---|---|
| `/login` | `velg-login-view` | Linked — nav chrome (`UserMenu.ts`) |
| `/register` | `velg-register-view` | Linked — `LoginView.ts`, `LoginPanel.ts`, landing pages |
| `/dashboard` | `velg-simulations-dashboard` | Linked — nav chrome (`PlatformHeader.ts`), `CommandPalette.ts` |
| `/multiverse` | `velg-cartographer-map` | Linked — nav chrome (`PlatformHeader.ts`), `CommandPalette.ts` |
| `/epoch` | `velg-epoch-command-center` | Linked — nav chrome (`PlatformHeader.ts`), `CommandPalette.ts`, `SimulationsDashboard.ts` |
| `/epoch/join` | `velg-epoch-invite-accept-view` | No in-app nav citation found (only the route's own `EpochInviteAcceptView.ts`); pattern matches `/invitations/:token` and `/epoch/:epochId` — an email-invitation entry point by design, not a UI dead end. |
| `/epoch/:epochId` | `velg-epoch-command-center` | Linked — comment in app-shell.ts: 'every cycle/phase/completion notification email links here', plus onboarding hand-off |
| `/forge` | `velg-forge-wizard / velg-forge-clearance-required` | Linked — nav chrome (`PlatformHeader.ts`), `SimulationsDashboard.ts`, `SimulationShell.ts`, `EpochCreationWizard.ts` |
| `/how-to-play` | `velg-how-to-play-landing` | Linked — nav chrome (`PlatformHeader.ts`) |
| `/how-to-play/quickstart` | `velg-how-to-play-quickstart` | Linked from within `HowToPlayLanding.ts` (content hub, not persistent nav) |
| `/how-to-play/guide` | `velg-how-to-play-guide-hub` | Linked from within `HowToPlayLanding.ts` |
| `/how-to-play/guide/:topic` | `velg-how-to-play-topic` | Linked from `HowToPlayGuideHub.ts`, `VelgHelpTip.ts` (contextual help links), `VelgForgeClearanceRequired.ts` |
| `/how-to-play/competitive` | `velg-how-to-play-war-room` | Linked from `HowToPlayLanding.ts` / `HowToPlayGuideHub.ts` |
| `/archives` | `velg-bureau-archives` | Linked — nav chrome (`PlatformHeader.ts`), `SimulationsDashboard.ts` |
| `/commendations` | `velg-achievement-grid` | Linked — `VelgAchievementSummaryCard.ts:324` (`navigate('/commendations')` on a dashboard card), not persistent nav |
| `/journal` | `velg-resonance-journal` | Linked — nav chrome (`PlatformHeader.ts`) |
| `/journal/constellations/:id` | `velg-constellation-canvas` | Linked from `VelgConstellationList.ts` (within `/journal`), not persistent nav |
| `/archetypes/:archetypeId` | `velg-archetype-detail` | Linked from `DungeonShowcase.ts` (landing page) and admin content-draft/dungeon-content tabs |
| `/bureau/dispatch` | `velg-bureau-dispatch-terminal` | Linked from the alpha-suite ARG chrome (`VelgFirstContactModal.ts`, `VelgBuildStrip.ts`) and `AdminInstagramTab.ts`; not persistent nav — by design, this is the Cipher-ARG redemption terminal |
| `/invitations/:token` | `velg-invitation-accept-view` | Linked from `AccessSettingsPanel.ts` (invite-link generation UI); primary entry point is an emailed link, not in-app nav |
| `/profile` | `velg-user-profile-view` | **UNLINKED.** No `href`, `navigate()`, or `.goto()` targeting `/profile` exists anywhere in `frontend/src` outside `app-shell.ts`'s own route definition. `UserMenu.ts` (the one place a 'My Profile' entry would live) has exactly one item: 'Sign Out'. Reachable only by typing the URL — and per Task 3, both of its data operations (load memberships, save profile) call non-existent backend routes, so even a user who finds it cannot use it. |
| `/new-simulation` | `velg-create-simulation-wizard` | Linked — `SimulationSwitcher.ts:453` (`navigate(canForge ? '/forge' : '/new-simulation')`) |
| `/admin` | `velg-admin-panel` | Linked — nav chrome (`PlatformHeader.ts`, admin-only) |
| `/simulations/:id/lore/:entitySlug` | `velg-simulation-lore-view` | Linked — `SimulationNav.ts` tab 'lore' (entity slug reached via in-page links) |
| `/simulations/:id/lore` | `velg-simulation-lore-view` | Linked — `SimulationNav.ts` tab 'lore' |
| `/simulations/:id/broadsheet` | `velg-simulation-broadsheet` | Linked — `SimulationNav.ts` tab 'broadsheet' |
| `/simulations/:id/chronicle` | `velg-chronicle-view` | Linked — `SimulationNav.ts` tab 'chronicle' |
| `/simulations/:id/health` | `velg-simulation-health-view` | Linked — `SimulationNav.ts` tab 'health' |
| `/simulations/:id/pulse` | `velg-simulation-pulse` | Linked — `SimulationNav.ts` tab 'pulse' |
| `/simulations/:id/agents/:entitySlug` | `velg-agents-view` | Linked — `SimulationNav.ts` tab 'agents' (entity slug reached via in-page links) |
| `/simulations/:id/buildings/:entitySlug` | `velg-buildings-view` | Linked — `SimulationNav.ts` tab 'buildings' |
| `/simulations/:id/events/:entitySlug` | `velg-events-view` | Linked — `SimulationNav.ts` tab 'events' |
| `/simulations/:id/agents` | `velg-agents-view` | Linked — `SimulationNav.ts` tab 'agents' |
| `/simulations/:id/bonds` | `velg-bonds-view` | Linked — `SimulationNav.ts` tab 'bonds' |
| `/simulations/:id/buildings` | `velg-buildings-view` | Linked — `SimulationNav.ts` tab 'buildings' |
| `/simulations/:id/events` | `velg-events-view` | Linked — `SimulationNav.ts` tab 'events' |
| `/simulations/:id/chat` | `velg-chat-view` | Linked — `SimulationNav.ts` tab 'chat' |
| `/simulations/:id/social` | `velg-social-trends-view` | Linked — `SimulationNav.ts` tab 'social' |
| `/simulations/:id/locations` | `velg-locations-view` | Linked — `SimulationNav.ts` tab 'locations' |
| `/simulations/:id/atlas` | `velg-simulation-world-map` | Linked — `SimulationNav.ts` tab 'atlas' |
| `/simulations/:id/terminal` | `velg-terminal-view` | Linked — `SimulationNav.ts` tab 'terminal' |
| `/simulations/:id/dungeon` | `velg-dungeon-view` | Linked — `SimulationNav.ts` tab 'dungeon' |
| `/simulations/:id/drift` | `velg-drift-view` | Linked — `SimulationNav.ts` tab 'drift' |
| `/simulations/:id/settings` | `velg-settings-view` | Linked — `SimulationNav.ts` tab 'settings' (admin-only) |
| `/simulations/:id/epoch` | `(redirect, no render)` | Pure redirect to `/epoch` (`enter` calls `this._router.goto('/epoch')`, `render` returns empty). Not a content route. |
| `/simulations/:id` | `(redirect, no render)` | Pure redirect to `/simulations/:id/lore`. Not a content route. |
| `/worlds` | `velg-worlds-gallery` | Linked — nav chrome (`PlatformHeader.ts`), `LandingPage.ts`, `LandingAgentShowcase.ts` |
| `/chronicles` | `velg-chronicle-feed` | Linked — nav chrome (`PlatformHeader.ts`) |
| `/privacy` | `velg-content-page` | Linked — `PlatformFooter.ts` |
| `/terms` | `velg-content-page` | Linked — `PlatformFooter.ts` |
| `/data-deletion` | `velg-content-page` | **UNLINKED.** Registered in `content-registry.ts` and has its own SEO metadata, but `PlatformFooter.ts` links Privacy and Terms only — Data Deletion is not in the footer, and no other component references it. Reachable only by typing the URL (plausible by design for a compliance/app-store-required page, but worth a footer link). |
| `/worldbuilding` | `velg-content-page` | Linked — `PlatformFooter.ts` |
| `/ai-characters` | `velg-content-page` | Linked — `PlatformFooter.ts` |
| `/strategy-game` | `velg-content-page` | Linked — `PlatformFooter.ts` |
| `/perspectives/:slug` | `velg-content-page` | Linked — `PlatformFooter.ts` (5 of the perspective slugs are listed directly) |
| `/welcome` | `velg-landing-page` | Linked — `PlatformFooter.ts` ('About') |
| `/` | `velg-landing-page (anon) / velg-simulation-shell (member)` | Root — always reachable |

**57 routes total. 2 UNLINKED: `/profile`, `/data-deletion`.** 2 more (`/epoch/join`, `/invitations/:token`) have no in-app nav citation but are designed as email-link entry points, not accidents.


## Task 6 — Per-Feature-Area Counts

Classification is by backend router file, except three multi-area files split by path segment: `public.py` (74 endpoints spanning nearly every area), `simulations.py` (lore sub-routes -> lore, everything else -> admin), `connections.py` (map-data/battle-feed/bleed-gazette -> multiverse, the rest -> connections), and `cipher.py` (`/public/bureau/*` -> bureau, `/admin/instagram/*` -> social). 'with UI' = a matching frontend api-service method exists (path-level); a further breakdown of how many of those are never actually called by any component follows in the appendix. Two requested areas — **academy** and **terminal** — have **zero dedicated backend endpoints**: Academy is an onboarding-flavored Epoch mode (`AcademyEpochCard.ts`) that rides on the ordinary `epochs.py`/`bot_players.py` endpoints; Terminal (`velg-terminal-view`) is a frontend rendering mode over the same simulation-data endpoints (locations/events/agents/etc.) used by the graphical views, with no endpoints of its own. `campaigns.py` is not in the requested area list; it is folded into 'social' below (marketing/campaign CRUD) — flagged as a judgment call.

| Feature area | Endpoints total | With UI (path matches) | ...of which 0 component callers | Orphan-backend (external/documented) | Unused |
|---|---|---|---|---|---|
| agents | 33 | 29 | 5 | 0 | 4 |
| buildings | 15 | 14 | 4 | 0 | 1 |
| events | 18 | 17 | 4 | 0 | 1 |
| chat | 19 | 19 | 2 | 0 | 0 |
| embassies | 13 | 11 | 7 | 0 | 2 |
| resonances | 18 | 18 | 6 | 0 | 0 |
| bonds | 9 | 8 | 1 | 0 | 1 |
| journal | 11 | 11 | 0 | 0 | 0 |
| broadsheet | 6 | 6 | 3 | 0 | 0 |
| chronicle | 6 | 6 | 2 | 0 | 0 |
| dungeon | 28 | 28 | 7 | 0 | 0 |
| epoch | 67 | 64 | 9 | 1 | 2 |
| drift | 22 | 21 | 0 | 0 | 1 |
| forge | 62 | 59 | 7 | 0 | 3 |
| social | 68 | 66 | 31 | 0 | 2 |
| admin | 72 | 65 | 5 | 0 | 7 |
| bureau | 19 | 19 | 4 | 0 | 0 |
| terminal | 0 | 0 | 0 | 0 | 0 |
| world-map | 5 | 5 | 0 | 0 | 0 |
| achievements | 4 | 4 | 0 | 0 | 0 |
| aptitudes | 3 | 3 | 0 | 0 | 0 |
| academy | 0 | 0 | 0 | 0 | 0 |
| connections | 5 | 2 | 0 | 0 | 3 |
| heartbeat | 18 | 18 | 9 | 0 | 0 |
| locations | 16 | 16 | 4 | 0 | 0 |
| lore | 6 | 6 | 1 | 0 | 0 |
| multiverse | 3 | 3 | 0 | 0 | 0 |
| health | 13 | 7 | 0 | 0 | 6 |
| *other/platform (users, webhooks, seo, bare health)* | 17 | 12 | 3 | 5 | 0 |
| **TOTAL** | **576** | **537** | **114** | **6** | **33** |

Standout areas: **social** (68 endpoints, 31 of the 66 path-matched ones have zero component callers — the entire per-simulation `SocialMediaApiService` client (6 methods), the entire `CampaignsApiService` client (9 endpoints), `SocialTrendsApiService.fetch/workflow`, and half of the admin Instagram/news-scanner surface are wired but never invoked); **heartbeat** (18 endpoints, 9 with zero callers — the whole interactive half: anchors, attunements, event-responses); **embassies** (13 endpoints, 7 with zero callers — only create/list/getForBuilding are used; activate/suspend/dissolve/update/getById/listAllActive and the entire ward mechanic have no UI).

## Appendix — Matched-but-never-called methods (114 of 537)

These 114 endpoints have a correctly-matching frontend api-service method (right HTTP verb, right path) but that method is never invoked by any component, util, or service anywhere in `frontend/src` (checked via `grep` for `<instance>.<method>(` — including generic-typed call sites `<instance>.<method><T>(`  — across the whole tree, not just `components/`, after the 2 CRUD-inherited-method rows and 3 path-collision false positives found in earlier passes were corrected). This is a stronger signal than path-matching alone: it means the client is dead code, not merely 'exists'. Full list is in the Task 2 table above (rows marked 'dead client'). By api-service file, the biggest concentrations are: `SocialMediaApiService.ts` (6/6 methods — the entire file), `CampaignsApiService.ts` (9/9 — the entire file, wired end-to-end at the path level, never called), `HeartbeatApiService.ts` (9/17), `EmbassiesApiService.ts` (6/9), `DungeonApiService.ts` (5/22), `AdminApiService.ts` (10 methods across its instagram/bluesky/BYOK/dungeon-override sections), `BureauOpsApiService.ts` (4/8 — the whole budget sub-feature), `EpochsApiService.ts` (7/roughly 30).

Caveat: this is a static-grep check on TypeScript source, not a runtime trace. It would miss a call made through dynamic property access (`api['methodName']()`) or reflection; a targeted search for both across the api-consuming code found none, so this is not believed to be masking real usage. It would also credit a method as 'used' if the only caller is itself unreachable dead code one level up — this was not chased recursively.