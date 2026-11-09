import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CustomBlending,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  OctahedronGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  AdditiveBlending,
} from 'three';
import {
  dustFragment,
  dustVertex,
  glowFragment,
  glowVertex,
  ribbonFragment,
  ribbonVertex,
  solidFragment,
  solidVertex,
} from './shaders';

/**
 * THE DIGITAL CANVAS — the MEDAD ink sculpture.
 *
 * Two liquid-glass ribbons trace the strokes of the MEDAD "M"; illuminated
 * ink paths cross between them like the circuit lines of the logo, ending in
 * glass ring nodes, with the two diamonds of the mark floating at its heart.
 */

export interface SculptureOptions {
  reducedMotion: boolean;
  compact: boolean;
  /** Seconds to wait before the ink starts drawing (intro overlay). */
  delay: number;
}

export interface SculptureHandle {
  setPointer(x: number, y: number): void;
  setScroll(progress: number): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

const S = 1.32;
const v = (x: number, y: number, z = 0) => new Vector3(x * S, y * S, z * S);

const ELECTRIC = new Color('#4169FF');
const ICY = new Color('#9DB8FF');

// Premultiplied "over" with emissive colour: rgb is added, alpha veils.
function glassBlending(m: ShaderMaterial) {
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneMinusSrcAlphaFactor;
  m.transparent = true;
  m.depthWrite = false;
  return m;
}

function additive(m: ShaderMaterial) {
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneFactor;
  m.transparent = true;
  m.depthWrite = false;
  return m;
}

/** A flat band swept along a curve; twist and width are animated on the GPU. */
function ribbonGeometry(curve: CatmullRomCurve3, segments: number): BufferGeometry {
  const count = (segments + 1) * 2;
  const center = new Float32Array(count * 3);
  const side = new Float32Array(count * 3);
  const tangent = new Float32Array(count * 3);
  const sign = new Float32Array(count);
  const tAttr = new Float32Array(count);
  const position = new Float32Array(count * 3);
  const index: number[] = [];
  const zAxis = new Vector3(0, 0, 1);
  const s = new Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t).normalize();
    s.crossVectors(zAxis, tg).normalize();
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      center.set([p.x, p.y, p.z], j * 3);
      position.set([p.x, p.y, p.z], j * 3);
      side.set([s.x, s.y, s.z], j * 3);
      tangent.set([tg.x, tg.y, tg.z], j * 3);
      sign[j] = k === 0 ? 1 : -1;
      tAttr[j] = t;
    }
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setAttribute('aCenter', new BufferAttribute(center, 3));
  g.setAttribute('aSide', new BufferAttribute(side, 3));
  g.setAttribute('aTangent', new BufferAttribute(tangent, 3));
  g.setAttribute('aSign', new BufferAttribute(sign, 1));
  g.setAttribute('aT', new BufferAttribute(tAttr, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.6;
  return g;
}

export function createSculpture(
  canvas: HTMLCanvasElement,
  options: SculptureOptions,
): SculptureHandle {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  const maxDpr = options.compact ? 1.5 : 1.85;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 7);

  const root = new Group();
  const sculpture = new Group();
  root.add(sculpture);
  scene.add(root);

  const motion = options.reducedMotion ? 0 : 1;
  const disposables: { dispose(): void }[] = [];
  const timed: ShaderMaterial[] = [];
  const drawn: { material: ShaderMaterial; start: number; duration: number }[] = [];

  /* ── Glass ribbons: the two strokes of the M ─────────────────── */

  const ribbonCurves = [
    new CatmullRomCurve3(
      [
        v(-0.86, -1.04, 0.05),
        v(-0.9, -0.2, 0.0),
        v(-0.86, 0.5, -0.08),
        v(-0.72, 0.78, 0.0),
        v(-0.44, 0.48, 0.16),
        v(-0.14, 0.08, 0.26),
        v(0.06, -0.34, 0.2),
        v(0.2, -0.62, 0.05),
      ],
      false,
      'centripetal',
      0.5,
    ),
    new CatmullRomCurve3(
      [
        v(0.86, -1.04, -0.05),
        v(0.9, -0.2, 0.0),
        v(0.86, 0.5, 0.08),
        v(0.72, 0.78, 0.0),
        v(0.44, 0.48, -0.16),
        v(0.14, 0.08, -0.26),
        v(-0.06, -0.34, -0.2),
        v(-0.2, -0.62, -0.05),
      ],
      false,
      'centripetal',
      0.5,
    ),
  ];

  ribbonCurves.forEach((curve, i) => {
    const geometry = ribbonGeometry(curve, options.compact ? 160 : 260);
    const material = glassBlending(
      new ShaderMaterial({
        vertexShader: ribbonVertex,
        fragmentShader: ribbonFragment,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uOpacity: { value: 1 },
          uWidth: { value: 0.24 * S },
          uTwist: { value: 0.55 },
          uBaseTwist: { value: i === 0 ? 2.4 : -2.4 },
          uPhase: { value: i * 1.7 },
          uTint: { value: ICY.clone().lerp(ELECTRIC, 0.35) },
          uMotion: { value: motion },
        },
      }),
    );
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 1;
    sculpture.add(mesh);
    disposables.push(geometry, material);
    timed.push(material);
    drawn.push({ material, start: 0.15 + i * 0.12, duration: 1.9 });
  });

  /* ── Illuminated ink paths: the circuit lines of the logo ──── */

  const inkPaths: { points: Vector3[]; radius: number; offset: number }[] = [
    {
      points: [v(-0.74, 0.82, 0.12), v(-0.36, 0.44, 0.22), v(0.0, 0.08, 0.3), v(0.36, -0.28, 0.2), v(0.58, -0.5, 0.08)],
      radius: 0.011,
      offset: 0,
    },
    {
      points: [v(0.74, 0.86, -0.12), v(0.36, 0.48, -0.06), v(0.0, 0.08, 0.3), v(-0.36, -0.28, 0.2), v(-0.58, -0.5, 0.08)],
      radius: 0.011,
      offset: 0.45,
    },
    // Diamond contours — the two facets at the heart of the mark.
    {
      points: [v(0, -0.06, 0.3), v(0.13, -0.2, 0.3), v(0, -0.34, 0.3), v(-0.13, -0.2, 0.3)],
      radius: 0.008,
      offset: 0.2,
    },
    {
      points: [v(0, -0.5, 0.25), v(0.2, -0.7, 0.25), v(0, -0.9, 0.25), v(-0.2, -0.7, 0.25)],
      radius: 0.009,
      offset: 0.7,
    },
    // Orbit — a long stream of ink circling the sculpture.
    {
      points: Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2;
        return new Vector3(Math.cos(a) * 1.85 * S, Math.sin(a) * 0.32 * S - 0.1, Math.sin(a) * 1.0 * S);
      }),
      radius: 0.006,
      offset: 0.1,
    },
  ];

  inkPaths.forEach((path, i) => {
    const closed = i >= 2;
    const curve = new CatmullRomCurve3(path.points, closed, i >= 2 && i < 4 ? 'catmullrom' : 'centripetal', i >= 2 && i < 4 ? 0 : 0.5);
    const segs = options.compact ? 140 : 220;
    const isOrbit = i === 4;
    const layers = isOrbit ? [{ r: path.radius, f: 3.0, k: 0.55 }] : [
      { r: path.radius, f: 3.5, k: 1.15 },
      { r: path.radius * 5.5, f: 2.2, k: 0.16 },
    ];
    layers.forEach((layer) => {
      const geometry = new TubeGeometry(curve, segs, layer.r, 8, closed);
      const material = additive(
        new ShaderMaterial({
          vertexShader: glowVertex,
          fragmentShader: glowFragment,
          uniforms: {
            uTime: { value: 0 },
            uProgress: { value: 0 },
            uIntensity: { value: layer.k },
            uFalloff: { value: layer.f },
            uPulse: { value: isOrbit ? 3.2 : 2.4 },
            uSpeed: { value: isOrbit ? 0.05 : 0.11 },
            uOffset: { value: path.offset },
            uColor: { value: i % 2 === 0 ? ELECTRIC.clone() : ICY.clone().lerp(ELECTRIC, 0.5) },
            uMotion: { value: motion },
          },
        }),
      );
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = 2;
      sculpture.add(mesh);
      disposables.push(geometry, material);
      timed.push(material);
      drawn.push({ material, start: 0.55 + i * 0.16, duration: isOrbit ? 2.4 : 1.4 });
    });
  });

  /* ── Glass ring nodes ────────────────────────────────────────── */

  const solid = () =>
    glassBlending(
      new ShaderMaterial({
        vertexShader: solidVertex,
        fragmentShader: solidFragment,
        side: DoubleSide,
        uniforms: { uOpacity: { value: 0 }, uTint: { value: ICY.clone() } },
      }),
    );

  const glowSolid = () =>
    additive(
      new ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 1 },
          uIntensity: { value: 0 },
          uFalloff: { value: 1.6 },
          uPulse: { value: 0 },
          uSpeed: { value: 0 },
          uOffset: { value: 0 },
          uColor: { value: ELECTRIC.clone().lerp(ICY, 0.3) },
          uMotion: { value: motion },
        },
      }),
    );

  const fades: { material: ShaderMaterial; uniform: string; target: number; start: number }[] = [];
  const lineFades: { material: LineBasicMaterial; target: number; start: number }[] = [];
  const nodes: Group[] = [];
  [v(-0.74, 0.82, 0.12), v(0.74, 0.86, -0.12)].forEach((pos, i) => {
    const node = new Group();
    node.position.copy(pos);
    const ringGeo = new TorusGeometry(0.11 * S, 0.034 * S, 20, 64);
    const ringMat = solid();
    node.add(new Mesh(ringGeo, ringMat));
    const coreGeo = new SphereGeometry(0.045 * S, 24, 16);
    const coreMat = glowSolid();
    node.add(new Mesh(coreGeo, coreMat));
    sculpture.add(node);
    nodes.push(node);
    disposables.push(ringGeo, ringMat, coreGeo, coreMat);
    fades.push({ material: ringMat, uniform: 'uOpacity', target: 1, start: 0.4 + i * 0.1 });
    fades.push({ material: coreMat, uniform: 'uIntensity', target: 1.5, start: 0.6 + i * 0.1 });
  });

  /* ── Floating diamonds ──────────────────────────────────────── */

  const diamonds: Group[] = [];
  [
    { pos: v(0, -0.2, 0.3), size: 0.12 },
    { pos: v(0, -0.7, 0.25), size: 0.17 },
  ].forEach((d, i) => {
    const group = new Group();
    group.position.copy(d.pos);
    const geo = new OctahedronGeometry(d.size * S, 0);
    geo.scale(1, 1, 0.55);
    const mat = solid();
    group.add(new Mesh(geo, mat));
    const edges = new EdgesGeometry(geo);
    const lineMat = new LineBasicMaterial({
      color: ICY,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    group.add(new LineSegments(edges, lineMat));
    sculpture.add(group);
    diamonds.push(group);
    disposables.push(geo, mat, edges, lineMat);
    fades.push({ material: mat, uniform: 'uOpacity', target: 1, start: 1.0 + i * 0.15 });
    lineFades.push({ material: lineMat, target: 0.55, start: 1.1 + i * 0.15 });
  });

  /* ── Ink dust ───────────────────────────────────────────────── */

  const dustCount = options.compact ? 70 : 140;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < dustCount; i++) {
    const r = 1.2 + rand() * 2.4;
    const a = rand() * Math.PI * 2;
    dustPos.set([Math.cos(a) * r * 1.4, (rand() - 0.5) * 3.6, Math.sin(a) * r - 0.6], i * 3);
    dustSeed[i] = rand();
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new BufferAttribute(dustSeed, 1));
  const dustMat = additive(
    new ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uOpacity: { value: 0 },
        uMotion: { value: motion },
      },
    }),
  );
  const dust = new Points(dustGeo, dustMat);
  root.add(dust);
  disposables.push(dustGeo, dustMat);
  fades.push({ material: dustMat, uniform: 'uOpacity', target: 1, start: 1.2 });

  /* ── Layout ─────────────────────────────────────────────────── */

  const SIZE = { w: 2.7 * S, h: 2.45 * S };
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const fitH = SIZE.h / (0.84 * 2 * tan);
    const fitW = SIZE.w / (0.9 * 2 * tan * camera.aspect);
    camera.position.z = Math.max(fitH, fitW, 5.5);
    camera.updateProjectionMatrix();
    dustMat.uniforms.uPixelRatio!.value = renderer.getPixelRatio();
    if (!running) render(lastTime);
  }

  /* ── Loop ───────────────────────────────────────────────────── */

  const pointer = { x: 0, y: 0 };
  let scroll = 0;
  let running = false;
  let active = true;
  let raf = 0;
  let startTime = -1;
  let lastTime = 0;
  let prev = 0;
  const rot = { x: 0, y: 0 };

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

  function render(now: number) {
    if (startTime < 0) startTime = now;
    const t = options.reducedMotion ? 1000 : (now - startTime) / 1000 - options.delay;
    lastTime = now;
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    const time = Math.max(t, 0);

    for (const m of timed) m.uniforms.uTime!.value = time;
    for (const d of drawn) d.material.uniforms.uProgress!.value = ease((t - d.start) / d.duration) * 1.001;
    for (const f of fades) f.material.uniforms[f.uniform]!.value = f.target * ease((t - f.start) / 0.9);
    for (const f of lineFades) f.material.opacity = f.target * ease((t - f.start) / 0.9);

    const k = 1 - Math.exp(-dt * 3.2);
    const idle = motion * Math.sin(time * 0.32) * 0.12;
    const targetY = pointer.x * 0.34 * motion + idle + scroll * 0.9 - 0.06;
    const targetX = -pointer.y * 0.18 * motion + scroll * 0.18 + 0.04;
    rot.x += (targetX - rot.x) * (options.reducedMotion ? 1 : k);
    rot.y += (targetY - rot.y) * (options.reducedMotion ? 1 : k);
    sculpture.rotation.set(rot.x, rot.y, 0);
    root.position.y = Math.sin(time * 0.6) * 0.06 * motion + scroll * 0.9;
    const scale = 1 - scroll * 0.14;
    root.scale.setScalar(scale);
    dust.rotation.y = time * 0.02 * motion;

    nodes.forEach((n, i) => {
      n.rotation.y = time * 0.5 * motion + i;
      n.rotation.x = 0.3 + Math.sin(time * 0.4 + i) * 0.2 * motion;
    });
    diamonds.forEach((d, i) => {
      d.rotation.y = time * (0.35 + i * 0.12) * motion + i * 0.6;
      d.position.y = (i === 0 ? -0.2 : -0.7) * S + Math.sin(time * 0.8 + i * 2) * 0.03 * motion;
    });

    renderer.render(scene, camera);
  }

  function loop(now: number) {
    render(now);
    raf = requestAnimationFrame(loop);
  }

  function updateRunning() {
    const shouldRun = active && !document.hidden && !options.reducedMotion;
    if (shouldRun && !running) {
      running = true;
      prev = performance.now();
      raf = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  const onVisibility = () => updateRunning();
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  render(performance.now());
  updateRunning();

  return {
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    setScroll(p) {
      scroll = p;
      if (!running) render(performance.now());
    },
    setActive(value) {
      active = value;
      updateRunning();
    },
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
