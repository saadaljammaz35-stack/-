# 🌙 Lunar Sweep — Roblox moon-cleaning game

> **Original Roblox game** in the "clean the moon" genre: sweep moon dust off real terrain,
> sell it, upgrade your gear, drive cleaning vehicles, command robots and build your base
> anywhere on the moon. **One player per server: the whole moon is yours.**
> Name, zones, items, models, sounds and code are all original — inspired by the gameplay
> loop in the reference video, not a copy of any existing game's assets.

**The playable file:** [`build/LunarSweep.rbxlx`](build/LunarSweep.rbxlx) (also [`build/LunarSweep.rbxl`](build/LunarSweep.rbxl)).
Open it in Roblox Studio → press **Play**.

### What's new in v1.1 / الجديد في الإصدار 1.1
| | |
|---|---|
| 🎥 **First-person view** (default, `V` toggles) | منظور الشخص الأول افتراضياً، وزر `V` للتبديل |
| 🚙 **6 drivable cleaning vehicles** from the colony **Motor Pool** or your own **Garage** | 6 مركبات تنظيف تقودها بنفسك من الـ Motor Pool أو الكراج حقك |
| 🏗 **Build anywhere on the moon**: no plots, plus foundations, ramps, stairs, walls, light bridges, garages and travel beacons | ابنِ في أي مكان على القمر بدون أراضٍ، ومعه أرضيات ومنحدرات ودرج وجدران وجسور ضوئية وكراجات ومنارات سفر |
| 🛢 **Throw capsules** (`Q` while carrying). A **Capsule Catcher** sells them instantly at +10%, and conveyors carry them to your silo | ارمِ الكبسولة بـ `Q`، والـ Catcher يبيعها فوراً بزيادة 10%، والسيور تنقلها للمخزن |
| 🤖 **Assign robots to sectors** (up to 8 hexagons each) | خصّص كل روبوت لقطاعات معيّنة (حتى 8) |
| 👤 **Single player per server**: the whole moon is yours | لاعب واحد لكل سيرفر: القمر كله لك |
| 🌑 **Realistic lunar ground**: grey regolith palette, harsh airless lighting, optional photo-texture pack | أرض قمرية واقعية: ألوان رمادية، وإضاءة فضائية حادة، وحزمة صور واقعية اختيارية للأرض |
| 🖼 **Store art** in a realistic Roblox style: `assets/store/` | صور المتجر بستايل روبلوكس واقعي في `assets/store/` |

---

## 🇸🇦 بالعربي — ملخص سريع

### طريقة التشغيل
1. افتح Roblox Studio ← **File → Open from File** ← اختر `build/LunarSweep.rbxlx`.
2. اضغط **Play** (F5). تظهر شاشة تحميل لثوانٍ أثناء توليد سطح القمر، ثم تظهر القائمة الرئيسية ← اضغط **PLAY**.
3. اضغط **1** لإخراج الفرشاة، واضغط مطوّلاً بزر الفأرة الأيسر للتنظيف (تصوّب بالنقطة في منتصف الشاشة)، أو استخدم زر **SWEEP** على الجوال. **G** للتنظيف التلقائي، و**V** للتبديل بين منظور الشخص الأول والثالث، واضغط **Alt** مطوّلاً لتحرير الماوس.
4. عندما تمتلئ الحاوية، اذهب إلى **Dust Exchange** في المستعمرة واضغط **E** للبيع، أو اضغط **Q** لتعبئة الغبار في كبسولة، ثم **Q** مرة ثانية وأنت شايلها لترميها.
5. المركبات: من **Motor Pool** (جنب الطريق الشمالي في المستعمرة) أو من زر **Garage**، اشترِ مركبة واضغط **Take it out**، ثم **E** بجانبها للركوب. للقيادة **W/A/S/D**، وللتيربو **Shift**، وللأضواء **L**، ولتعبئة الخزان في كبسولة **Q**، وللنزول **Space**.
6. القاعدة: زر **Base (B)** ثم اختر مبنى وابنِ في أي مكان على القمر، إلا وسط المستعمرة والطرق والمناطق المقفلة. السيور تُسحب بخط مستقيم.

> ملاحظة: في وضع التحرير (قبل Play) لن ترى إلا نقطة البداية، لأن العالم (التضاريس والقاعدة والمحطات) يُولَّد تلقائياً عند تشغيل السيرفر. هذا مقصود حتى يبقى الملف صغيراً وقابلاً للتعديل.

### الإعدادات والصلاحيات المطلوبة (مرة واحدة)
| الإعداد | أين | لماذا |
|---|---|---|
| انشر اللعبة | File → Publish to Roblox | DataStore والترتيب العالمي والدعوات تحتاج لعبة منشورة |
| تفعيل الوصول لخدمات API | Game Settings → Security → **Enable Studio Access to API Services** | حفظ التقدم داخل Studio |
| عدد اللاعبين | Game Settings → Places → Max Players = **1** | القمر كله للاعب واحد. لو دخل لاعب ثاني بالغلط، تنقله اللعبة تلقائياً لسيرفر خاص فيه |
| المشرفون | ServerScriptService → Attribute `AdminUserIds` (مثال `12345,67890`) | لوحة الأدمن داخل اللعبة. في Studio ومالك اللعبة يعمل تلقائياً |
| الأصوات (اختياري) | ارفع ملفات `assets/audio/*.ogg` من **Asset Manager**، ثم أنشئ داخل `ReplicatedStorage → CustomSounds` كائن **Sound** باسم المفتاح (مثل `sweep` أو `cash`) وضع فيه الـ SoundId | اللعبة تشغّل أي صوت تضيفه هنا تلقائياً. أو استخدم `tools/upload_assets.py` لرفع الكل دفعة وحدة |
| أرض واقعية (اختياري) | ارفع الصور الثمان في `assets/textures/` من Asset Manager، وانسخ أرقامها داخل `tools/apply_textures.lua`، ثم الصقه في **Command Bar** واضغط Enter، واحفظ اللعبة | صور حقيقية للتراب والصخر والجليد القمري بدل خامات Roblox العادية |

بدون نشر اللعبة تعمل كل الأنظمة، لكن التقدم لا يُحفَظ (تظهر رسالة "Studio mode").

### ما تم تنفيذه واختباره
- عالم بتسع مناطق (+ المستعمرة)، كل منطقة بتضاريس ومواد وموارد وإضاءة وموسيقى وأسرار مختلفة. فيها كهوف تحت الأرض وكويكبات معلّقة في المدار.
- تنظيف حقيقي للتضاريس: الأرض المتسخة تتحول إلى نظيفة في Terrain، وتُقسَّم إلى قطاعات سداسية لكل منها نسبة نظافة، ويعود الغبار مع الوقت.
- 34 أداة، و17 حاوية، و28 ترقية متعددة المستويات، و17 روبوتاً بذكاء اصطناعي وطاقة وصيانة، و6 مركبات تنظيف، و34 مبنى وهيكل للقاعدة مع كهرباء وسيور نقل وإنتاج.
- اقتصاد بعدة عملات، وسوق متغير الأسعار، وصناديق باحتمالات معلنة، ومهام يومية وأسبوعية، و61 إنجازاً، ومكافآت دخول، وفعاليات موسمية، وأحداث سيرفر، وإعادة إطلاق (Prestige)، وتداول آمن، ولوحات ترتيب.
- واجهة كاملة: قائمة رئيسية، و HUD، و18 لوحة كل أزرارها فعّالة، ودعم للحاسب والجوال والآيباد ويد التحكم.

### القيود الحالية بصراحة
- لم أشغّل اللعبة داخل Roblox Studio نفسه (غير متاح في هذه البيئة). الاختبار تم بثلاث طرق: تحليل ثابت بأنواع Roblox (0 أخطاء)، و**تشغيل كود السيرفر والواجهة الحقيقيين** داخل محاكي Lune (111 اختباراً ناجحاً)، واختبار ذاتي يعمل تلقائياً داخل Studio عند Play. الرسوم والفيزياء والشبكة الحقيقية لا تُحاكى، لذلك قد تحتاج سرعة المركبات ونعومة القيادة والإضاءة لضبط بسيط بعد أول تجربة.
- **المركبات**: القيادة فيزيائية (LinearVelocity + AlignOrientation) ومجرّبة بالمنطق فقط، ولم تُجرَّب في محرك الفيزياء الحقيقي. الأرقام في `Config/Vehicles.luau` و `VehicleController.luau` سهلة التعديل.
- **التداول والتعاون** موجودان في الكود، لكنهما يحتاجان لاعبَين في نفس السيرفر، والسيرفر صار للاعب واحد. لذلك أُخفي زر التداول.
- النماذج مبنية من Parts إجرائية مفصّلة، وليست Meshes مرفوعة، لأن رفع الـ Meshes يحتاج حسابك.
- **الأصوات صامتة إلى أن ترفعها**. أزلتُ أصوات Roblox المدمجة كلها لأنها كانت تسبب الخطأ `Asset is not approved for the requester` الذي ظهر لك. أما الخطأ `rbxassetid://911864050` فليس من اللعبة، بل من إضافة (Plugin) أو موديل من الـ Toolbox عندك في Studio.
- صور الأرض الواقعية تحتاج رفعاً من حسابك (خطوة واحدة موضّحة في الجدول فوق). بدونها تستخدم اللعبة خامات Roblox بألوان قمرية واقعية.
- الواجهة باللغة الإنجليزية. التوثيق بالعربية والإنجليزية.

---

## 1. Quick start (English)

1. **Roblox Studio → File → Open from File →** `build/LunarSweep.rbxlx`
2. Press **Play**. A loading screen shows the server generating the moon (~1–5 s), then the
   title screen appears → **PLAY**.
3. Press **1** to take out your toothbrush, **hold Left Mouse** to sweep the dust in front of
   you (mobile: hold **SWEEP**; gamepad: **R2**). **G** toggles auto-sweep.
4. When the container is full, walk to the **Dust Exchange** (north side of the plaza) and press
   **E**, or press **Q** to pack it into a capsule and keep cleaning. Press **Q** again while
   carrying a capsule to **throw** it: a Capsule Catcher sells it instantly (+10%), and a conveyor
   carries it to your silo.
5. Spend credits at the **Supply Wall** (tools/containers), **Upgrade Terminal**, **Robot Bay**
   and **Motor Pool** (vehicles). Build your base **anywhere** from the **Base** menu (**B**).

The game starts in **first person** (crosshair aiming). Press **V** for third person; hold **Alt**
to free the mouse. Your Command Center is placed east of the colony on your first visit.

In **edit mode** you only see the spawn pad: the terrain, colony, garage and props are generated
by the server when the game runs, which keeps the place file small and the world easy to tweak
from code (`TerrainGenerator.luau`, `HubBuilder.luau`, `WorldDecor.luau`).

### Controls
| Action | PC | Mobile | Gamepad |
|---|---|---|---|
| Equip / unequip tool | `1` or tool button | tool button | `L1` |
| Sweep | hold Left Mouse (aim with mouse) | hold **SWEEP** | hold `R2` |
| Auto-sweep | `G` | **AUTO** | — |
| Pack capsule / **throw** carried capsule | `Q` | **PACK** / **THROW** | `Y` |
| First / third person | `V` (hold `Alt` = free mouse) | — | `L3` |
| Get in a vehicle | `E` next to it | tap prompt | `X` |
| Drive / turbo / lights / pack hopper / get out | `WASD` / `Shift` / `L` / `Q` / `Space` | thumbstick / **TURBO** / **LIGHTS** / **PACK** / **EXIT** | sticks + triggers / `L1` / D-pad up / `Y` / `A` |
| Interact (sell, shops, gates, relics) | `E` (`F` = store in silo at your base) | tap prompt | `X` |
| Jetpack boost (after Thrust Assist upgrade) | `Space` in mid-air | jump in mid-air | `A` in mid-air |
| Map / Base / Upgrades / Gear / Missions | `M` / `B` / `U` / `I` / `J` | menu buttons | menu buttons |
| Build mode: rotate / place (drag for conveyor & tile lines) / exit | `R` / click or drag / `X` | **Rotate** / **PLACE** / **Exit** | `X` / `R2` / `B` |

## 2. Studio settings & permissions

| Setting | Where | Why |
|---|---|---|
| Publish the place | File → Publish to Roblox | DataStores, global leaderboards and friend invites only work in a published experience |
| **Enable Studio Access to API Services** | Game Settings → Security | Saves progress while testing in Studio |
| Max players = **1** | Game Settings → Places | One player owns the whole moon. `SoloService` also moves any extra joiner to their own private server (published games only) |
| Avatar type R15 (default) | Game Settings → Avatar | Tool hold pose and helmet/backpack attachment points |
| Admins | ServerScriptService attribute **`AdminUserIds`** = `"123,456"` | In-game Admin/QA panel (Studio and the place owner are always admins) |
| Self test on Play | ServerScriptService attribute **`RunSelfTests`** (default `true`, Studio only) | Prints a PASS/FAIL report to Output |
| Streaming | Already enabled in the place (`StreamingTargetRadius` 640) | Mobile memory/performance |

Without publishing, everything still works but progress is kept **in memory only**. A toast
says "Studio mode: progress will not be saved".

### Audio (optional but recommended)
The game ships with 36 original, procedurally synthesized sounds and music loops in
`assets/audio/*.ogg`. Built-in `rbxasset://` sounds are **not** used: Roblox now blocks some of
them with "Asset is not approved for the requester". Until you add yours, the game is silent.

**Easiest: in Studio.** Asset Manager → Bulk Import the `.ogg` files. Then, in
`ReplicatedStorage → CustomSounds`, add a **Sound** named after each key (for example `sweep`,
`cash`, `music_hub`; the full list is in `Config/Sounds.luau`) and paste the uploaded SoundId.
Sounds in this folder always win.

**Or with a script:**
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

### Realistic ground textures (optional)
`assets/textures/` has 4 seamless lunar textures (dust, swept ground, rock, frost), each with a
colour map and a normal map. They were made from generated photos with `tools/make_textures.py`.
Scripts can't assign texture images at runtime, so apply them once in Studio:
1. Asset Manager → Bulk Import the 8 images and copy each asset id.
2. Paste the ids into `tools/apply_textures.lua`, paste the whole file into the **Command Bar**
   and press Enter. It creates `MaterialVariant`s in MaterialService and overrides the terrain
   materials the zones use.
3. Save the place. The game still tints each zone with its own regolith colour.

### Store art
`assets/store/icon_512.png` and `thumb_vehicle.jpg`, `thumb_base.jpg`, `thumb_zones.jpg`
(1920×1080) are ready for the game page (Creator Dashboard → your experience → Places / Thumbnails).

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
- 28 upgrades across 8 categories (including Vehicles).
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

**Base building (34 buildings and structures).**
- Built anywhere on the moon (see *Build anywhere* below). Your Command Center is placed east of the colony on your first visit; older plot saves are migrated automatically.
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

**Vehicles (v1.1).**
- 6 hover vehicles:
  - Push Sweeper
  - Crew Transport
  - Ride-on Sweeper
  - Lunar Sweeper
  - Mega Vacuum Rover
  - Titan Harvester
- Each vehicle has its own speed, cleaning width, hopper (kg), dust depth and seats.
- Buy them and take them out at the colony **Motor Pool** or your own **Garage** building.
- Driving: the client owns the physics (LinearVelocity + AlignOrientation hover with ground tilt). The server checks speed allowance, locked zones and fall-off recovery.
- The front brush cleans a wide strip; the server validates every intake stroke against the vehicle's position.
- Cargo is saved in your profile. Unload it at the Exchange or your base, or press **Q** to pack it.
- Vehicle upgrades: Tuned Motors, Big Hopper, Suction Control, Turbo Kit, Floodlights.

**Build anywhere (v1.1).**
- No plots: build on the whole moon's 4-stud grid, except the colony core, roads, the garage, locked zones and steep ground.
- Ghost preview (green/red) mirrors the server checks. Drag conveyors and foundation tiles in lines of up to 40.
- Cells under buildings stop holding dust, so sectors can still be completed.
- Structures: foundations (1×1, 2×2, 4×4), ramps, stairs, walls, light bridges, garages and travel beacons. Beacons appear on the Map for fast travel.

**Capsule throwing & catching (v1.1).**
- **Q** throws the carried capsule along a real ballistic arc, with range raised by the Throw Assist upgrade.
- Landing near a **Capsule Catcher** sells it instantly at +10%.
- Landing on a conveyor rides it to the nearest silo or catcher.
- Hauler robots ignore capsules that are in flight or on a belt.

**Robots by sector (v1.1).** Pick up to 8 hex sectors per cleaner or collector on a mini-map in the Robot Bay. Robots work those sectors first, then the rest of the zone.

**Single-player moon (v1.1).**
- One player per server: set Max Players = 1. `SoloService` also moves extra joiners to their own private server.
- Independent saves per player with session locking.
- Friend invites and global leaderboards still work.
- Co-op bonuses and safe trading stay in the code for anyone who changes the server size, but the Trade button is hidden.

**Technical.**
- 27 server services with dependency-ordered Init and Start.
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
- 18 panels, every button functional:
  - Shop
  - Garage (vehicles)
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
| Static analysis: luau-lsp with full Roblox API type definitions, all 102 files / ~20.6k lines | **0 errors** |
| `tests/unit.luau`: config integrity, cross references, geometry, formulas | **18 / 18** |
| `tests/server_smoke.luau`: boots the real server scripts from the built place, generates the world and plays through every system with simulated players. Covers vehicles, throwing and catching, robot sectors and building anywhere | **47 / 47** |
| `tests/client_smoke.luau`: runs the real client, builds the HUD + 18 panels, opens every panel, clicks every button, feeds every server message, and tests the first-person camera, vehicle HUD and sector picker | **46 / 46** |
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
  robot hover heights, **vehicle handling**: the hover-drive math in `VehicleController.luau`
  is logic-tested but has never run in the real physics engine).
- **Runtime world generation.** Terrain and the colony appear when the server starts, not in
  edit mode.
- **Models are procedural Part assemblies,** not uploaded MeshParts or textures (uploading needs
  your account). Animations are procedural (tool sway, spinners, pistons, conveyors) and use the
  default R15 tool-hold pose.
- **Audio.** Silent until you add your uploaded sounds (see Audio). This is on purpose: built-in
  sounds are blocked for some accounts.
- **Ground textures** need a one-time upload from your account. Without them the terrain uses
  Roblox materials with a realistic grey palette.
- **Server size.** One player per server by design. Co-op and trading only matter if you raise
  Max Players yourself.
- **Global leaderboards and persistence** need a published place with API access.
- **Robots** warp between the base and their zone and hover over terrain inside a zone. They
  don't pathfind around props.
- **UI language** is English; the docs are Arabic + English.
- **No Robux monetization** (game passes or developer products) is included.

## 7. Customizing

- **Content and balance:** edit the tables in `src/ReplicatedStorage/Shared/Config/*.luau`
  (prices, stats, odds, zones, events), then rebuild.
- **Formulas** (XP curve, multipliers, robot scaling): `Shared/Formulas.luau`.
- **World shape:** `MapLayout.luau` (home, garage, build rules, stations, caves, asteroids),
  `TerrainGenerator.luau` (heights, craters, ridges), `WorldDecor.luau` (props).
- **Sky:** set the Lighting attribute `UseSkyDome = false` to use your own uploaded star skybox
  instead of the built-in black dome.
