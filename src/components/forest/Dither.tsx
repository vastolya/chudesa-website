"use client";

import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";

/**
 * Static triangular dither (±1 LSB, in sRGB space). Breaks up 8-bit banding in
 * smooth dark gradients — e.g. the lantern cone on blue snow. Depends only on
 * the pixel position, never on time, so it cannot shimmer.
 */
const fragment = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = gl_FragCoord.xy;
  float n = hash12(px) + hash12(px + 71.3) - 1.0; // triangular distribution, -1..1
  vec3 s = pow(max(inputColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  s += n / 255.0;
  outputColor = vec4(pow(max(s, vec3(0.0)), vec3(2.2)), inputColor.a);
}
`;

class DitherEffect extends Effect {
  constructor() {
    super("DitherEffect", fragment, { blendFunction: BlendFunction.NORMAL });
  }
}

export const Dither = wrapEffect(DitherEffect);
