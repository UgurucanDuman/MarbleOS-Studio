/**
 * Tetikleyici butondaki ikonu hayalet katmana taşırken HTML metni yerine DOM kopyası kullanılır.
 * Kopya; betik, dış içerik ve olay özniteliklerinden arındırılır. Böylece ikon kaynağı
 * ileride kullanıcı verisinden gelse bile hayalet katman kod çalıştıramaz.
 */
const BLOCKED_TAGS = new Set([
  'script', 'foreignobject', 'iframe', 'object', 'embed', 'image', 'a',
  'animate', 'animatemotion', 'animatetransform', 'set', 'style',
]);

function isSafeAttribute(name: string, value: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith('on')) return false;
  if (lower === 'href' || lower === 'xlink:href' || lower === 'src') return value.trim().startsWith('#');
  if (lower === 'style') return !/url\s*\(|expression\s*\(/i.test(value);
  return true;
}

function scrub(element: Element): void {
  for (const attr of Array.from(element.attributes)) {
    if (!isSafeAttribute(attr.name, attr.value)) element.removeAttribute(attr.name);
  }
  for (const child of Array.from(element.children)) {
    if (BLOCKED_TAGS.has(child.localName.toLowerCase())) child.remove();
    else scrub(child);
  }
}

export function cloneSafeSvg(source: SVGSVGElement): SVGSVGElement {
  const copy = source.cloneNode(true) as SVGSVGElement;
  scrub(copy);
  return copy;
}
