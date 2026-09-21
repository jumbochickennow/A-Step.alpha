import { describe, expect, it } from 'vitest';
import { createKineticLabelSegments } from '../src/lib/kinetic-label';

describe('createKineticLabelSegments', () => {
  it('keeps Latin spaces while enabling character staggering', () => {
    const segments = createKineticLabelSegments('Immigration Tracking');

    expect(segments.map(({ text }) => text).join('')).toBe('Immigration Tracking');
    expect(segments.filter(({ isSpace }) => !isSpace)).toHaveLength(19);
    expect(segments.find(({ isSpace }) => isSpace)?.text).toBe(' ');
  });

  it('keeps Arabic words joined so contextual glyph shaping is preserved', () => {
    const segments = createKineticLabelSegments('معلومات موثوقة');

    expect(segments).toEqual([
      { text: 'معلومات', isSpace: false },
      { text: ' ', isSpace: true },
      { text: 'موثوقة', isSpace: false },
    ]);
  });
});
