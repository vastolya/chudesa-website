const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

export const blobVertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec3 uMouse;
uniform float uExcite;

varying vec3 vNormal;
varying vec3 vWorld;
varying float vNoise;

${noise}

float field(vec3 p){
  float t = uTime * 0.22;
  float n = snoise(p * uFreq + vec3(t, t * 0.6, -t));
  n += 0.35 * snoise(p * uFreq * 2.4 - vec3(t * 1.4));
  // pull toward pointer — a soft "touch" bulge
  float m = smoothstep(0.55, 1.0, dot(normalize(p), normalize(uMouse)));
  return n * (uAmp + uExcite * 0.12) + m * (0.18 + uExcite * 0.25);
}

vec3 displaced(vec3 p){
  vec3 n = normalize(p);
  return p + n * field(p);
}

void main(){
  vec3 p = position;
  vec3 n = normalize(normal);
  vec3 t = normalize(cross(n, abs(n.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 b = normalize(cross(n, t));
  float e = 0.01;
  float r = length(p);
  vec3 p0 = displaced(p);
  vec3 p1 = displaced(normalize(p + t * e) * r);
  vec3 p2 = displaced(normalize(p + b * e) * r);
  vec3 cr = cross(p1 - p0, p2 - p0);
  vec3 dn = length(cr) > 1e-7 ? normalize(cr) : n;
  if (dot(dn, n) < 0.0) dn = -dn;

  vNoise = field(p);
  vNormal = normalize(normalMatrix * dn);
  vec4 world = modelMatrix * vec4(p0, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const blobFragment = /* glsl */ `
uniform float uTime;
uniform float uHue;
uniform float uTheme;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vNoise;

vec3 pal(float t){
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0, 0.33, 0.67) + uHue;
  return a + b * cos(6.28318 * (c * t + d));
}

void main(){
  vec3 N = vNormal / max(length(vNormal), 1e-5);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(clamp(1.0 - ndv, 0.0, 1.0), 2.2);

  vec3 irid = pal(fres * 1.1 + vNoise * 0.9 + uTime * 0.03);
  vec3 lime = vec3(0.78, 1.0, 0.18);

  vec3 L1 = normalize(vec3(0.6, 0.9, 0.7));
  vec3 L2 = normalize(vec3(-0.8, -0.3, 0.4));
  float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 48.0);
  float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 20.0);
  float diff = max(dot(N, L1), 0.0);

  vec3 core = vec3(0.025, 0.022, 0.035);
  vec3 col = mix(core, irid, 0.12 + fres * 0.95);
  col += irid * diff * 0.12;
  col += vec3(1.0) * spec * 0.9;
  col += lime * spec2 * 0.55;
  col += lime * smoothstep(0.25, 0.5, vNoise) * 0.25;

  // inverted mood over the lime section
  col = mix(col, vec3(0.04) + irid * fres * 0.6, uTheme);

  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.9)), 1.0);
}
`;
