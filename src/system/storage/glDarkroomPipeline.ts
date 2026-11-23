import { resolveFullAdjustments } from './photoColorMath';
import { effectivePhotoZoom } from './portraitSmartAlignMath';
import type { PhotoAdjustments } from '../sqlite/types';

/**
 * İZOLE SİSTEM KATMANI: WebGL Karanlık Oda Shader Boru Hattı
 * Kadraj (zoom, panX, panY, rotation, tilt) + Işık/Renk (brightness, contrast, shadows,
 * highlights, warmth [-30..+30], saturation [0..140], 5-tap sharpen) GPU üzerinde işlenir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const VERTEX_SHADER_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
uniform vec2 u_fitScale;
uniform float u_boxAspect;
uniform float u_zoom;
uniform vec2 u_pan;
uniform int u_rot;
uniform float u_tiltRad;
void main() {
  vec2 uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  if (u_rot == 90) {
    v_uv = vec2(uv.y, 1.0 - uv.x);
  } else if (u_rot == 180) {
    v_uv = vec2(1.0 - uv.x, 1.0 - uv.y);
  } else if (u_rot == 270) {
    v_uv = vec2(1.0 - uv.y, uv.x);
  } else {
    v_uv = uv;
  }
  vec2 pos = a_pos * u_fitScale + vec2(u_pan.x * 2.0, -u_pan.y * 2.0);
  if (u_tiltRad != 0.0) {
    vec2 iso = vec2(pos.x * u_boxAspect, pos.y);
    float c = cos(-u_tiltRad);
    float s = sin(-u_tiltRad);
    iso = vec2(iso.x * c - iso.y * s, iso.x * s + iso.y * c);
    pos = vec2(iso.x / u_boxAspect, iso.y);
  }
  gl_Position = vec4(pos * u_zoom, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texelStep;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_shadows;
uniform float u_highlights;
uniform float u_warmth;
uniform float u_saturation;
uniform float u_sharpen;
void main() {
  if (v_uv.x < 0.0 || v_uv.x > 1.0 || v_uv.y < 0.0 || v_uv.y > 1.0) {
    gl_FragColor = vec4(0.03, 0.03, 0.035, 1.0);
    return;
  }
  vec4 center = texture2D(u_tex, v_uv);
  vec3 rgb = center.rgb;
  if (u_sharpen > 0.0) {
    vec3 n = texture2D(u_tex, v_uv + vec2(0.0, -u_texelStep.y)).rgb;
    vec3 s = texture2D(u_tex, v_uv + vec2(0.0, u_texelStep.y)).rgb;
    vec3 e = texture2D(u_tex, v_uv + vec2(u_texelStep.x, 0.0)).rgb;
    vec3 w = texture2D(u_tex, v_uv + vec2(-u_texelStep.x, 0.0)).rgb;
    vec3 blur = (n + s + e + w) * 0.25;
    rgb = clamp(rgb + (rgb - blur) * u_sharpen, 0.0, 1.0);
  }
  rgb = (rgb * u_brightness - 0.5) * u_contrast + 0.5;
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  if (u_shadows != 0.0) {
    float sm = pow(1.0 - clamp(luma, 0.0, 1.0), 2.0);
    rgb += vec3(u_shadows * 0.48 * sm);
  }
  if (u_highlights != 0.0) {
    float hm = pow(clamp(luma, 0.0, 1.0), 2.0);
    rgb += vec3(u_highlights * 0.45 * hm);
  }
  if (u_warmth != 0.0) {
    rgb += vec3(u_warmth * 0.24, u_warmth * 0.05, -u_warmth * 0.26);
  }
  if (u_saturation != 1.0) {
    float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = mix(vec3(gray), rgb, u_saturation);
  }
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), center.a);
}
`;

export interface GlPipeline {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  texture: WebGLTexture;
  uFitScale: WebGLUniformLocation | null;
  uBoxAspect: WebGLUniformLocation | null;
  uZoom: WebGLUniformLocation | null;
  uPan: WebGLUniformLocation | null;
  uRot: WebGLUniformLocation | null;
  uTiltRad: WebGLUniformLocation | null;
  uTexelStep: WebGLUniformLocation | null;
  uBrightness: WebGLUniformLocation | null;
  uContrast: WebGLUniformLocation | null;
  uShadows: WebGLUniformLocation | null;
  uHighlights: WebGLUniformLocation | null;
  uWarmth: WebGLUniformLocation | null;
  uSaturation: WebGLUniformLocation | null;
  uSharpen: WebGLUniformLocation | null;
  imgW: number;
  imgH: number;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createGlPipeline(canvas: HTMLCanvasElement): GlPipeline | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    const attrs: WebGLContextAttributes = {
      alpha: false, antialias: true, depth: false, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    };
    gl = (canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs)) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return {
    gl, program, buffer, texture,
    uFitScale: gl.getUniformLocation(program, 'u_fitScale'),
    uBoxAspect: gl.getUniformLocation(program, 'u_boxAspect'),
    uZoom: gl.getUniformLocation(program, 'u_zoom'),
    uPan: gl.getUniformLocation(program, 'u_pan'),
    uRot: gl.getUniformLocation(program, 'u_rot'),
    uTiltRad: gl.getUniformLocation(program, 'u_tiltRad'),
    uTexelStep: gl.getUniformLocation(program, 'u_texelStep'),
    uBrightness: gl.getUniformLocation(program, 'u_brightness'),
    uContrast: gl.getUniformLocation(program, 'u_contrast'),
    uShadows: gl.getUniformLocation(program, 'u_shadows'),
    uHighlights: gl.getUniformLocation(program, 'u_highlights'),
    uWarmth: gl.getUniformLocation(program, 'u_warmth'),
    uSaturation: gl.getUniformLocation(program, 'u_saturation'),
    uSharpen: gl.getUniformLocation(program, 'u_sharpen'),
    imgW: 1, imgH: 1,
  };
}

export function drawGlFrame(pipe: GlPipeline, canvas: HTMLCanvasElement, adj: PhotoAdjustments, coverMode = true) {
  const { gl } = pipe;
  const full = resolveFullAdjustments(adj);
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const displayW = Math.max(1, Math.round((canvas.clientWidth || 240) * dpr));
  const displayH = Math.max(1, Math.round((canvas.clientHeight || 300) * dpr));
  if (canvas.width !== displayW || canvas.height !== displayH) {
    canvas.width = displayW;
    canvas.height = displayH;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.02, 0.02, 0.025, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const effW = full.rotation === 90 || full.rotation === 270 ? pipe.imgH : pipe.imgW;
  const effH = full.rotation === 90 || full.rotation === 270 ? pipe.imgW : pipe.imgH;
  const boxAspect = canvas.width / Math.max(1, canvas.height);
  const imgAspect = effW / Math.max(1, effH);
  const scaleX = coverMode ? (imgAspect > boxAspect ? imgAspect / boxAspect : 1) : (imgAspect > boxAspect ? 1 : imgAspect / boxAspect);
  const scaleY = coverMode ? (imgAspect > boxAspect ? 1 : boxAspect / imgAspect) : (imgAspect > boxAspect ? boxAspect / imgAspect : 1);
  const tiltRad = (full.tilt * Math.PI) / 180;

  gl.useProgram(pipe.program);
  gl.uniform2f(pipe.uFitScale, scaleX, scaleY);
  gl.uniform1f(pipe.uBoxAspect, boxAspect);
  gl.uniform1f(pipe.uZoom, effectivePhotoZoom(full.zoom, full.tilt));
  gl.uniform2f(pipe.uPan, full.panX / 100, full.panY / 100);
  gl.uniform1i(pipe.uRot, full.rotation);
  gl.uniform1f(pipe.uTiltRad, tiltRad);
  gl.uniform2f(pipe.uTexelStep, 1 / Math.max(1, pipe.imgW), 1 / Math.max(1, pipe.imgH));
  gl.uniform1f(pipe.uBrightness, full.brightness / 100);
  gl.uniform1f(pipe.uContrast, full.contrast / 100);
  gl.uniform1f(pipe.uShadows, full.shadows / 100);
  gl.uniform1f(pipe.uHighlights, full.highlights / 100);
  gl.uniform1f(pipe.uWarmth, full.warmth / 100);
  gl.uniform1f(pipe.uSaturation, full.saturation / 100);
  gl.uniform1f(pipe.uSharpen, (full.sharpen / 40) * 1.35);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
