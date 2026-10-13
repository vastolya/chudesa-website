import * as THREE from "three";
import { FOG_COLOR, FOG_DENSITY } from "./creatureMaterial";

/**
 * Shared GLSL for the seven wonder bodies.
 * envStudio(): an analytic "photo studio" (soft boxes + strip lights) so gold, foil,
 * chrome and the prism have something beautiful to reflect/refract — with no HDR
 * download and identical results in the forest and in the hand-held overlay.
 */
export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uGlow;
uniform vec3 uFogColor;
uniform float uFogDensity;

float hash13(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

vec3 envStudio(vec3 d){
  d = normalize(d);
  vec3 c = mix(vec3(0.015, 0.02, 0.05), vec3(0.10, 0.13, 0.26), smoothstep(-0.6, 0.9, d.y));
  // big soft box above-right
  c += vec3(1.0, 0.98, 0.95) * smoothstep(0.90, 0.985, dot(d, normalize(vec3(0.55, 0.75, 0.35)))) * 3.2;
  // warm kicker on the left
  c += vec3(1.0, 0.78, 0.5) * smoothstep(0.92, 0.985, dot(d, normalize(vec3(-0.75, 0.25, 0.45)))) * 2.2;
  // cool strip lights (horizontal + vertical)
  c += vec3(0.75, 0.88, 1.0) * smoothstep(0.03, 0.0, abs(d.y - 0.42)) * smoothstep(-0.2, 0.4, d.z) * 1.6;
  c += vec3(0.8, 0.9, 1.0) * smoothstep(0.035, 0.0, abs(d.x + 0.35)) * smoothstep(0.0, 0.5, d.y) * 1.2;
  // ground bounce
  c += vec3(0.25, 0.3, 0.5) * smoothstep(-0.2, -0.9, d.y) * 0.25;
  return c;
}

// thin-film interference tint (soap bubble / foil)
vec3 thinFilm(float cosT, float thickness){
  float d = thickness * (1.2 - cosT * 0.6);
  return 0.5 + 0.5 * cos(6.28318 * (d * vec3(1.0, 0.82, 0.66) + vec3(0.0, 0.33, 0.67)));
}

// distance to the nearest Voronoi edge (cell walls)
float voronoiEdge(vec3 x){
  vec3 p = floor(x);
  vec3 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 o = vec3(hash13(p + b), hash13(p + b + 17.1), hash13(p + b + 31.7));
    o = 0.5 + 0.45 * sin(uTime * 0.6 + 6.2831 * o);
    float dd = length(b + o - f);
    if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
  }
  return d2 - d1;
}

vec3 fogIt(vec3 col, vec3 wpos){
  float dist = length(cameraPosition - wpos);
  float f = clamp(1.0 - exp(-pow(uFogDensity * 0.55 * dist, 2.0)), 0.0, 1.0);
  return mix(col, uFogColor, f);
}
`;

export function commonUniforms(fog: boolean) {
  return {
    uTime: { value: 0 },
    uOpacity: { value: 1 },
    uGlow: { value: 0.3 },
    uFogColor: { value: FOG_COLOR },
    uFogDensity: { value: fog ? FOG_DENSITY : 0 },
  };
}

/** Standard vertex passing world position / world normal / object position. */
export const VERT_BASIC = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main(){
  vP = position;
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/** what the owner tells a body every frame; active=false → nothing is updated (out of sight) */
export type Drive = { opacity: number; glow: number; active?: boolean };

export function shader(opts: { vertex?: string; fragment: string; uniforms?: Record<string, THREE.IUniform>; fog: boolean; additive?: boolean; double?: boolean; depthWrite?: boolean; defines?: Record<string, string> }) {
  return new THREE.ShaderMaterial({
    defines: opts.defines ?? {},
    vertexShader: opts.vertex ?? VERT_BASIC,
    fragmentShader: opts.fragment,
    uniforms: { ...commonUniforms(opts.fog), ...(opts.uniforms ?? {}) },
    transparent: true,
    depthWrite: opts.depthWrite ?? !opts.additive,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
  });
}
