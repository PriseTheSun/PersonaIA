import { BadRequestException } from '@nestjs/common';
import { validateAvatarDataUrl } from './avatar-image';

const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('avatar image validation', () => {
  it('accepts a small PNG and reads its dimensions', () => {
    const result = validateAvatarDataUrl(`data:image/png;base64,${onePixelPng}`);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('rejects SVG content even when encoded as a data URL', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    expect(() => validateAvatarDataUrl(`data:image/svg+xml;base64,${svg}`)).toThrow(BadRequestException);
  });

  it('rejects images with dimensions above the decompression guard', () => {
    const oversized = Buffer.from(onePixelPng, 'base64');
    oversized.writeUInt32BE(5000, 16);
    expect(() => validateAvatarDataUrl(`data:image/png;base64,${oversized.toString('base64')}`)).toThrow(BadRequestException);
  });
});
