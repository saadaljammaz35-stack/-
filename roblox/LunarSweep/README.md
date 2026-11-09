# 🌙 Lunar Sweep — Roblox moon-cleaning game

> **Original Roblox game** in the "clean the moon" genre: sweep moon dust off real terrain,
> sell it, upgrade your gear, command robots and build a production base on your own plot.
> Name, zones, items, models, sounds and code are all original — inspired by the gameplay
> loop in the reference video, not a copy of any existing game's assets.

**The playable file:** [`build/LunarSweep.rbxlx`](build/LunarSweep.rbxlx) (also [`build/LunarSweep.rbxl`](build/LunarSweep.rbxl)).
Open it in Roblox Studio → press **Play**.

---

## 🇸🇦 بالعربي — ملخص سريع

### طريقة التشغيل
1. افتح Roblox Studio ← **File → Open from File** ← اختر `build/LunarSweep.rbxlx`.
2. اضغط **Play** (F5). تظهر شاشة تحميل لثوانٍ أثناء توليد سطح القمر، ثم تظهر القائمة الرئيسية ← اضغط **PLAY**.
3. اضغط **1** لإخراج الفرشاة، واضغط مطوّلاً بزر الفأرة الأيسر للتنظيف، أو استخدم زر **SWEEP** على الجوال. اضغط **G** للتنظيف التلقائي.
4. عندما تمتلئ الحاوية، اذهب إلى **Dust Exchange** في المستعمرة واضغط **E** للبيع، أو اضغط **Q** لتعبئة الغبار في كبسولة.

> ملاحظة: في وضع التحرير (قبل Play) لن ترى إلا نقطة البداية، لأن العالم (التضاريس والقاعدة والمحطات) يُولَّد تلقائياً عند تشغيل السيرفر. هذا مقصود حتى يبقى الملف صغيراً وقابلاً للتعديل.

### الإعدادات والصلاحيات المطلوبة (مرة واحدة)
| الإعداد | أين | لماذا |
|---|---|---|
| انشر اللعبة | File → Publish to Roblox | DataStore والترتيب العالمي والدعوات تحتاج لعبة منشورة |
| تفعيل الوصول لخدمات API | Game Settings → Security → **Enable Studio Access to API Services** | حفظ التقدم داخل Studio |
| عدد اللاعبين | Game Settings → Places → Max Players = **8** | توجد 8 قواعد شخصية في كل سيرفر |
| المشرفون | ServerScriptService → Attribute `AdminUserIds` (مثال `12345,67890`) | لوحة الأدمن داخل اللعبة. في Studio ومالك اللعبة يعمل تلقائياً |
| الأصوات المخصصة (اختياري) | `tools/upload_assets.py` مع مفتاح Open Cloud | رفع 34 صوتاً وموسيقى أصلية وربطها تلقائياً |

بدون نشر اللعبة تعمل كل الأنظمة، لكن التقدم لا يُحفَظ (تظهر رسالة "Studio mode").

### ما تم تنفيذه واختباره
- عالم بتسع مناطق (+ المستعمرة)، كل منطقة بتضاريس ومواد وموارد وإضاءة وموسيقى وأسرار مختلفة. فيها كهوف تحت الأرض وكويكبات معلّقة في المدار.
- تنظيف حقيقي للتضاريس: الأرض المتسخة تتحول إلى نظيفة في Terrain، وتُقسَّم إلى قطاعات سداسية لكل منها نسبة نظافة، ويعود الغبار مع الوقت.
- 34 أداة، و17 حاوية، و22 ترقية متعددة المستويات، و17 روبوتاً بذكاء اصطناعي وطاقة وصيانة، و26 مبنى للقاعدة مع كهرباء وسيور نقل وإنتاج.
- اقتصاد بعدة عملات، وسوق متغير الأسعار، وصناديق باحتمالات معلنة، ومهام يومية وأسبوعية، و61 إنجازاً، ومكافآت دخول، وفعاليات موسمية، وأحداث سيرفر، وإعادة إطلاق (Prestige)، وتداول آمن، ولوحات ترتيب.
- واجهة كاملة: قائمة رئيسية، و HUD، و17 لوحة كل أزرارها فعّالة، ودعم للحاسب والجوال والآيباد ويد التحكم.

### القيود الحالية بصراحة
- لم أشغّل اللعبة داخل Roblox Studio نفسه (غير متاح في هذه البيئة). الاختبار تم بثلاث طرق: تحليل ثابت بأنواع Roblox (0 أخطاء)، و**تشغيل كود السيرفر والواجهة الحقيقيين** داخل محاكي Lune (102 اختبار ناجح)، واختبار ذاتي يعمل تلقائياً داخل Studio عند Play. الرسوم والفيزياء والشبكة الحقيقية لا تُحاكى، لذلك قد يحتاج توازن الإضاءة أو الأرقام لضبط بسيط بعد التجربة.
- النماذج مبنية من Parts إجرائية مفصّلة، وليست Meshes مرفوعة، لأن رفع الـ Meshes يحتاج حسابك.
- الأصوات تعمل بأصوات Roblox المدمجة إلى أن ترفع الأصوات الأصلية بالأداة، والموسيقى صامتة قبل الرفع.
- الواجهة باللغة الإنجليزية. التوثيق بالعربية والإنجليزية.

---

## 1. Quick start (English)

1. **Roblox Studio → File → Open from File →** `build/LunarSweep.rbxlx`
2. Press **Play**. A loading screen shows the server generating the moon (~1–5 s), then the
   title screen appears → **PLAY**.
3. Press **1** to take out your toothbrush, **hold Left Mouse** to sweep the dust in front of
   you (mobile: hold **SWEEP**; gamepad: **R2**). **G** toggles auto-sweep.
4. When the container is full, walk to the **Dust Exchange** (north side of the plaza) and press
   **E**, or press **Q** to pack it into a capsule and keep cleaning.
5. Spend credits at the **Supply Wall** (tools/containers), **Upgrade Terminal**, **Robot Bay**,
   and build your base from the **Base** menu (**B**).

In **edit mode** you only see the spawn pad: the terrain, colony, plots and props are generated
by the server when the game runs, which keeps the place file small and the world easy to tweak
from code (`TerrainGenerator.luau`, `HubBuilder.luau`, `WorldDecor.luau`).

### Controls
| Action | PC | Mobile | Gamepad |
|---|---|---|---|
| Equip / unequip tool | `1` or tool button | tool button | `L1` |
| Sweep | hold Left Mouse (aim with mouse) | hold **SWEEP** | hold `R2` |
| Auto-sweep | `G` | **AUTO** | — |
| Pack capsule / drop carried capsule | `Q` | **PACK** | `Y` |
| Interact (sell, shops, gates, relics) | `E` (`F` = store in silo at your base) | tap prompt | `X` |
| Jetpack boost (after Thrust Assist upgrade) | `Space` in mid-air | jump in mid-air | `A` in mid-air |
| Map / Base / Upgrades / Gear / Missions | `M` / `B` / `U` / `I` / `J` | menu buttons | menu buttons |
| Build mode: rotate / place / exit | `R` / click / `X` | **Rotate** / **PLACE** / **Exit** | `X` / `R2` / `B` |

## 2. Studio settings & permissions

| Setting | Where | Why |
|---|---|---|
| Publish the place | File → Publish to Roblox | DataStores, global leaderboards and friend invites only work in a published experience |
| **Enable Studio Access to API Services** | Game Settings → Security | Saves progress while testing in Studio |
| Max players = **8** | Game Settings → Places | One personal base plot per player (8 plots) |
| Avatar type R15 (default) | Game Settings → Avatar | Tool hold pose and helmet/backpack attachment points |
| Admins | ServerScriptService attribute **`AdminUserIds`** = `"123,456"` | In-game Admin/QA panel (Studio and the place owner are always admins) |
| Self test on Play | ServerScriptService attribute **`RunSelfTests`** (default `true`, Studio only) | Prints a PASS/FAIL report to Output |
| Streaming | Already enabled in the place (`StreamingTargetRadius` 640) | Mobile memory/performance |

Without publishing, everything still works but progress is kept **in memory only**. A toast
says "Studio mode: progress will not be saved".

### Uploading the original audio (optional but recommended)
The game ships with 34 original, procedurally synthesized sounds and music loops in
`assets/audio/*.ogg`. Until they are uploaded, the game uses sounds that ship with every
Roblox client (`rbxasset://sounds/...`) and music stays silent.

1. Create an Open Cloud key at <https://create.roblox.com/dashboard/credentials>.
   Use API **Assets**, with permissions `asset:read` and `asset:write`, and an IP allow-list
   (your IP, or `0.0.0.0/0`).
2. Run:
   ```bash
   export ROBLOX_API_KEY=xxxxx
   python3 tools/upload_assets.py --user-id <your user id>   # or --group-id <group id>
   ```
   The script uploads each file, writes the ids into
   `src/ReplicatedStorage/Shared/Config/AudioIds.luau` and rebuilds the place if `rojo` is
   installed. Roblox audio upload quotas and moderation apply. Re-running skips files that are
   already uploaded.

`assets/images/icon_512.png` and `thumbnail_1920x1080.png` are ready for the game page
(Creator Dashboard → your experience → Places / Thumbnails).

## 3. Working from source (Rojo)

```bash
rokit install              # installs rojo 7.6.1, lune 0.9.4, luau-lsp 1.38.0 (rokit.toml / aftman.toml)
tools/build.sh             # -> build/LunarSweep.rbxlx + build/LunarSweep.rbxl
tools/test.sh              # build + static analysis + all test suites -> build/test-report.txt
rojo serve                 # live-sync into Studio with the Rojo plugin
python3 tools/synth_audio.py   # regenerate assets/audio
python3 tools/make_images.py   # regenerate assets/images
```

```
roblox/LunarSweep/
├── default.project.json        Rojo project: services, Lighting, Workspace settings
├── build/                      LunarSweep.rbxlx / .rbxl  (ready to open in Studio)
├── src/
│   ├── ReplicatedFirst/        Loading screen
│   ├── ReplicatedStorage/Shared/
│   │   ├── Config/             All game data (zones, tools, containers, upgrades, robots,
│   │   │                       buildings, resources, missions, achievements, crates,
│   │   │                       events, prestige, relics, sounds, tuning)
│   │   ├── ModelFactory/       Procedural 3D models (tools, robots, buildings, items)
│   │   ├── Formulas.luau       Every gameplay formula (shared by server and client)
│   │   ├── MapLayout.luau      World layout, zone grid, hex sector math
│   │   ├── Net.luau            Remote definitions
│   │   └── Util/               Signal, Format, TableUtil
│   ├── ServerScriptService/
│   │   ├── Main.server.luau    Boots 24 services in order
│   │   └── Services/           Data, World/Terrain/Hub/Decor, Sector, Cleaning, Pickup,
│   │                           Player, Economy, Shop, Crate, Capsule, Base, Robot,
│   │                           Mission, Achievement, LoginReward, Event, Rebirth, Trade,
│   │                           Leaderboard, Zone (+anti-exploit), Secret, Admin, SelfTest
│   └── StarterPlayerScripts/
│       ├── Client.client.luau  Client bootstrap
│       ├── Controllers/        ClientData, Sweep, FX, Sound, Sky, Zone, Sector, Build,
│       │                       Camera, Movement, Prompt, RobotVisual
│       └── UI/                 Lib, Theme, Viewport, HUD, MainMenu, UIController, Panels/ (17)
├── assets/audio/               34 original .ogg sound effects & music loops
├── assets/images/              icon + thumbnail
├── tools/                      build/test scripts, audio & image generators, Open Cloud uploader
└── tests/                      Lune harness + unit / server / client suites
```

## 4. Features (implemented and tested)

**World — 9 zones + colony.**
- Each zone has its own terrain style, dirt and clean materials, dust type, three to four debris types, unlock level and cost, lighting mood, music and a hidden relic:
  - Tranquility Colony (hub)
  - Dusty Flats
  - Pockmark Craters
  - Junkyard Expanse
  - Crystal Caverns (underground chambers, tunnels and entrance ramps)
  - Frostbite Basin (ice spires)
  - Ember Rift (lava channels, vents)
  - Shadow Side (permanent night, auto helmet lamp)
  - Starfall Basin (giant impact basin)
  - Orbital Ring (floating asteroids linked by light bridges, reached by the launch pad)
- Terrain is ~2.2 M voxels generated at server start: fbm noise, craters with rims, mountain ridges with passes between zones, and slope-aware cleanable areas.
- Black space sky with stars, the Sun and a slowly turning Earth.
- Force-field zone gates, plus props:
  - crashed landers and satellites
  - crystal clusters
  - meteorites
  - glyph stones and a monolith
  - lava glow
- 10 hidden relics.

**Cleaning.**
- Real terrain cleaning: dirty voxels become clean material along your stroke.
- Server-validated: tool, distance, rate, zone access and capacity are all checked on the server.
- The moon is split into 341 hexagonal sectors, each with a live clean %. Glowing sector borders are drawn on the ground.
- Finishing a sector pays a bounty (and a gem) to everyone who helped.
- Dust regrows over time, so a server never runs out.
- Debris pickups with rarities and a luck system.
- Capacity in kg; tool width, reach, depth (kg multiplier) and magnet stats.
- Feedback:
  - dust particles
  - procedural tool sway
  - footprint ring
  - floating "+kg" text
  - pickups flying into your backpack
  - sounds
- Capsules: pack your container (Q), carry it, sell it, recall it, or let robots and the catcher bring it home.

**Gear & progression.**
- 34 tools: brushes, brooms, push brooms, vacuums, canister vacs, wands, rakes and plasma.
- 17 containers worn on the back, with a live fill gauge.
- 22 upgrades across 7 categories.
- 6 rarities. Crate-exclusive and event-exclusive gear.
- Shop with stat comparison against your equipped gear.
- Level 1–100 XP curve, with gems on level up.

**Robots (17).**
- Cleaners fly (warp) to their assigned zone and actually clean terrain with the same code players use.
- Collectors hunt debris. Haulers fetch your capsules; the Cargo Lifter also auto-sells your silo.
- Helpers follow you: +capacity, a floodlight, auto-shipping, repairs, +XP.
- Battery drains while working and recharges at docks depending on base power.
- Wear lowers efficiency; broken robots need repair.
- Levels 1–10. Robot slots come from the Command Center, Robot Docks and a prestige perk.
- Offline work estimate when you return.

**Base building (26 buildings).**
- Personal 24×24 plot (8 per server).
- Grid placement with a ghost preview, rotation, edit mode, upgrades, removal with refund, and a building limit tied to the Command Center level (1–5).
- Silos. Power from solar panels, trackers and a fusion reactor; power use per building.
- Conveyor connectivity (BFS): production only runs when linked to storage.
- Production buildings:
  - Extractor and deep drills
  - Pressure chamber (bricks)
  - Stone press
  - Crystal refinery (also makes gems)
  - Helium-3 extractor
- Battery banks, robot docks, capsule catcher, research lab, and a launch pad that auto-sells.
- Decor buildings.
- Offline production (capped) and live status lights.

**Economy & live ops.**
- Currencies: Credits, Gems, Cosmic Stars (prestige) and seasonal tokens.
- Market prices drift ±18% per resource (deterministic, shown on the Exchange board).
- 4 crates with published odds, duplicate protection and a 30-open pity.
- Missions: 3 daily and 3 weekly, scaled to your progress.
- 61 achievements, with wearable titles.
- 7-day login streak rewards.
- 5 seasonal events by month (Harvest Moon is active in November), each with an event shop.
- Random server events every 7–12 minutes:
  - Meteor Shower
  - Dust Storm
  - Solar Flare
  - Debris Frenzy
- Re-Launch prestige with 8 perks.
- Global (OrderedDataStore) and in-server leaderboards; physical boards in the colony.

**Multiplayer.**
- Shared terrain, so cleaning is truly cooperative.
- Co-op bonus of +10% per nearby sweeper, up to +30%.
- Server-wide community goal: when filled, everyone gets 2× credits for 3 minutes.
- Friend invites.
- Safe trading:
  - crate/event gear and gems only
  - Ready → review countdown → Confirm
  - items re-validated before the swap
  - both profiles saved immediately
- Independent saves per player with session locking.

**Technical.**
- 24 server services with dependency-ordered Init and Start.
- Single routed RemoteFunction with per-action token-bucket rate limits and type validation; unreliable remotes for cosmetic effects.
- DataStore profiles:
  - session lock
  - retries and request-budget waits
  - autosave every 90 s
  - BindToClose
  - template reconciliation and migration hook
  - JSON sanitizing
  - in-memory fallback in Studio
- Anti-exploit checks:
  - speed and teleport, with rubber-banding and a kick threshold
  - locked-zone enforcement
  - out-of-world recovery
  - stroke distance and rate validation
  - ownership checks on capsules, bases and trades
- StreamingEnabled with persistent hub stations.
- Client effects run on cached lists; sector lines are local parts drawn only near you.

**UI.**
- Loading screen and title screen with an orbiting camera; How-to-Play guide.
- HUD:
  - currencies
  - level/XP
  - zone and sector banner
  - server event and community goal
  - boosts
  - menu with notification badges
  - container gauge
  - tool slot
  - mobile SWEEP / AUTO / PACK buttons
  - tutorial tips
- 17 panels, every button functional:
  - Shop
  - Gear/Inventory
  - Upgrades
  - Robots
  - Base
  - Missions
  - Daily rewards
  - Crates (with roll animation)
  - Map (sector heatmap, players, robots, fast travel)
  - Achievements
  - Leaderboards
  - Event
  - Re-Launch
  - Trade
  - Settings
  - Suit locker
  - Admin/QA
- Toasts, reward pop-ups and responsive scaling for phone, tablet and PC.

## 5. Testing

`tools/test.sh` runs everything and writes `build/test-report.txt`. Latest run:

| Check | Result |
|---|---|
| Rojo build (`.rbxlx` + `.rbxl`) | OK |
| Static analysis: luau-lsp with full Roblox API type definitions, all 96 files / ~18k lines | **0 errors** |
| `tests/unit.luau`: config integrity, cross references, geometry, formulas | **18 / 18** |
| `tests/server_smoke.luau`: boots the real server scripts from the built place, generates the world and plays through every system with simulated players | **43 / 43** |
| `tests/client_smoke.luau`: runs the real client, builds HUD + 17 panels, opens every panel, clicks every button, feeds every server message | **41 / 41** |
| In-game `SelfTest` (runs automatically on Play in Studio) | **14 / 14** inside the harness |

The suites run on [Lune](https://lune-org.github.io), which deserializes the place and runs the
same Luau code, with polyfills for engine features Lune does not emulate (`tests/harness.luau`).
They found and fixed real bugs before release:
- a UI-toolkit bug that would have stopped the HUD from building on desktop
- a capsule-recall accounting bug
- wasted deferred viewport renders

## 6. Known limitations (honest list)

- **Not run inside Roblox Studio itself.** Studio is not available in this build environment.
  Coverage comes from Roblox-typed static analysis, the headless suites running the real code,
  and the in-Studio SelfTest. The real renderer, physics and networking are not emulated.
  Expect small tuning passes after your first play session (lighting balance, economy pacing,
  robot hover heights).
- **Runtime world generation.** Terrain and the colony appear when the server starts, not in
  edit mode.
- **Models are procedural Part assemblies,** not uploaded MeshParts or textures (uploading needs
  your account). Animations are procedural (tool sway, spinners, pistons, conveyors) and use the
  default R15 tool-hold pose.
- **Audio.** Built-in client sounds are used until you run the uploader. Music is silent until
  uploaded.
- **Server size.** 8 players per server (8 base plots).
- **Global leaderboards and persistence** need a published place with API access.
- **Robots** warp between the base and their zone and hover over terrain inside a zone. They
  don't pathfind around props.
- **UI language** is English; the docs are Arabic + English.
- **No Robux monetization** (game passes or developer products) is included.

## 7. Customizing

- **Content and balance:** edit the tables in `src/ReplicatedStorage/Shared/Config/*.luau`
  (prices, stats, odds, zones, events), then rebuild.
- **Formulas** (XP curve, multipliers, robot scaling): `Shared/Formulas.luau`.
- **World shape:** `MapLayout.luau` (plots, stations, caves, asteroids),
  `TerrainGenerator.luau` (heights, craters, ridges), `WorldDecor.luau` (props).
- **Sky:** set the Lighting attribute `UseSkyDome = false` to use your own uploaded star skybox
  instead of the built-in black dome.
