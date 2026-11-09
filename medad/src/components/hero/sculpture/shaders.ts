/**
 * Shaders for the MEDAD ink sculpture.
 *
 * Everything is lit by a procedural studio environment (no HDR download):
 * a soft top light, a vertical strip on the left, an electric-blue key on the
 * right and an icy rim from behind. Glass writes premultiplied colour with a
 * small alpha, so it adds light while gently veiling what is behind it.
 */

const ENV = /* glsl */ `
vec3 studioEnv(vec3 r) {
  r = normalize(r);
  vec3 c = vec3(0.010, 0.013, 0.026) + vec3(0.018, 0.026, 0.065) * (r.y * 0.5 + 0.5);
  c += vec3(0.88, 0.92, 1.0) * smoothstep(0.55, 0.96, r.y) * 0.85;
  vec3 hz = normalize(vec3(r.x, 0.0, r.z) + 1e-4);
  float strip = smoothstep(0.93, 0.995, dot(hz, normalize(vec3(-0.86, 0.0, 0.52))));
  c += vec3(0.80, 0.86, 1.0) * strip * smoothstep(-0.35, 0.45, r.y) * 1.15;
  c += vec3(0.25, 0.41, 1.0) * pow(max(dot(r, normalize(vec3(0.9, 0.12, 0.42))), 0.0), 7.0) * 1.35;
  c += vec3(0.62, 0.72, 1.0) * pow(max(dot(r, normalize(vec3(-0.25, 0.35, -1.0))), 0.0), 4.0) * 0.55;
  c += vec3(0.10, 0.17, 0.48) * smoothstep(-0.15, -0.9, r.y) * 0.45;
  return c;
}
`;

/* ── Glass ribbon ─────────────────────────────────────────────── */

export const ribbonVertex = /* glsl */ `
attribute vec3 aCenter;
attribute vec3 aSide;
attribute vec3 aTangent;
attribute float aSign;
attribute float aT;

uniform float uTime;
uniform float uWidth;
uniform float uTwist;
uniform float uBaseTwist;
uniform float uPhase;
uniform float uMotion;

varying vec3 vPosW;
varying vec3 vNormalW;
varying vec2 vUv;

void main() {
  float t = aT;
  float wave = sin(t * 3.4 + uTime * 0.55 * uMotion + uPhase);
  float angle = uBaseTwist * (t - 0.5) + uTwist * wave;
  vec3 binormal = normalize(cross(aTangent, aSide));
  vec3 dir = aSide * cos(angle) + binormal * sin(angle);
  float profile = pow(sin(3.14159265 * clamp(t, 0.0, 1.0)), 0.42);
  float breathe = 1.0 + 0.12 * sin(t * 9.0 - uTime * 0.9 * uMotion + uPhase);
  float w = uWidth * profile * breathe;
  vec3 drift = binormal * 0.035 * sin(t * 6.0 + uTime * 0.7 * uMotion + uPhase) * uMotion;
  vec3 pos = aCenter + dir * aSign * w * 0.5 + drift;
  vec3 n = normalize(cross(aTangent, dir));

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vUv = vec2(t, aSign * 0.5 + 0.5);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ribbonFragment = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uOpacity;
uniform vec3 uTint;
uniform float uMotion;

varying vec3 vPosW;
varying vec3 vNormalW;
varying vec2 vUv;

${ENV}

void main() {
  if (vUv.x > uProgress) discard;
  float head = smoothstep(uProgress, uProgress - 0.06, vUv.x);

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);

  vec3 refl = studioEnv(reflect(-V, N));
  vec3 refr = studioEnv(refract(-V, N, 0.69));

  float across = abs(vUv.y * 2.0 - 1.0);
  float edge = smoothstep(0.80, 1.0, across);
  float flow = pow(0.5 + 0.5 * sin((vUv.x * 5.0 - uTime * 0.28 * uMotion) * 6.2831), 10.0);

  vec3 col = refr * uTint * 0.16
    + refl * (0.16 + fres * 1.25)
    + vec3(0.78, 0.85, 1.0) * edge * 0.55
    + vec3(0.45, 0.6, 1.0) * flow * 0.28 * (1.0 - across * 0.6);

  float alpha = clamp(0.04 + fres * 0.4 + edge * 0.2, 0.0, 0.8);
  float k = head * uOpacity;
  gl_FragColor = vec4(col * k, alpha * k * 0.55);
}
`;

/* ── Solid glass (rings, diamonds) ────────────────────────────── */

export const solidVertex = /* glsl */ `
varying vec3 vPosW;
varying vec3 vNormalW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const solidFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uTint;
varying vec3 vPosW;
varying vec3 vNormalW;

${ENV}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.6);
  vec3 refl = studioEnv(reflect(-V, N));
  vec3 refr = studioEnv(refract(-V, N, 0.67));
  vec3 col = refr * uTint * 0.6 + refl * (0.3 + fres * 1.5) + uTint * fres * 0.4;
  float alpha = clamp(0.1 + fres * 0.6, 0.0, 0.9);
  gl_FragColor = vec4(col * uOpacity, alpha * uOpacity * 0.6);
}
`;

/* ── Glowing ink path (tubes) ─────────────────────────────────── */

export const glowVertex = /* glsl */ `
varying vec3 vPosW;
varying vec3 vNormalW;
varying vec2 vUv;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const glowFragment = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform float uFalloff;
uniform float uPulse;
uniform float uSpeed;
uniform float uOffset;
uniform vec3 uColor;
uniform float uMotion;
varying vec3 vPosW;
varying vec3 vNormalW;
varying vec2 vUv;

void main() {
  if (vUv.x > uProgress) discard;
  vec3 V = normalize(cameraPosition - vPosW);
  float ndv = abs(dot(normalize(vNormalW), V));
  float core = pow(ndv, uFalloff);

  float p = fract(vUv.x * 1.6 - uTime * uSpeed * uMotion + uOffset);
  float pulse = exp(-pow((p - 0.5) * 9.0, 2.0));
  float tip = exp(-(uProgress - vUv.x) * 45.0) * step(uProgress, 0.999);

  vec3 col = mix(uColor, vec3(1.0), core * 0.65) * core;
  col *= 0.55 + pulse * uPulse + tip * 3.0;
  gl_FragColor = vec4(col * uIntensity, 0.0);
}
`;

/* ── Ink dust ─────────────────────────────────────────────────── */

export const dustVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform float uMotion;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.12 * uMotion + aSeed * 40.0) * 0.12;
  p.x += cos(uTime * 0.09 * uMotion + aSeed * 23.0) * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.4 + aSeed * 2.6) * uPixelRatio * (6.0 / -mv.z);
  vAlpha = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) * uMotion + aSeed * 12.0));
}
`;

export const dustFragment = /* glsl */ `
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(0.62, 0.72, 1.0) * a * vAlpha * uOpacity, 0.0);
}
`;
