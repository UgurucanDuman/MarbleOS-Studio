// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { cloneSafeSvg } from './safeSvgClone';

function parseSvg(markup: string): SVGSVGElement {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host.querySelector('svg')!;
}

test('cloneSafeSvg keeps drawing geometry but strips scripts, handlers and external links', () => {
  const source = parseSvg(
    '<svg viewBox="0 0 10 10" onload="alert(1)">'
      + '<script>alert(2)</script>'
      + '<foreignObject><div>x</div></foreignObject>'
      + '<a href="javascript:alert(3)"><path d="M0 0"/></a>'
      + '<use href="https://evil.test/x.svg#a"/>'
      + '<use href="#local"/>'
      + '<path d="M1 1L9 9" stroke="currentColor" onclick="alert(4)" style="fill:url(https://evil.test)"/>'
      + '</svg>',
  );

  const copy = cloneSafeSvg(source);
  const html = copy.outerHTML.toLowerCase();

  expect(copy).not.toBe(source);
  expect(html).not.toContain('script');
  expect(html).not.toContain('foreignobject');
  expect(html).not.toContain('javascript:');
  expect(html).not.toContain('onload');
  expect(html).not.toContain('onclick');
  expect(html).not.toContain('evil.test');
  expect(Array.from(copy.querySelectorAll('use'), (use) => use.getAttribute('href'))).toEqual([null, '#local']);
  expect(copy.querySelector('path[d="M1 1L9 9"]')?.getAttribute('stroke')).toBe('currentColor');
  expect(source.querySelector('script')).not.toBeNull();
});
