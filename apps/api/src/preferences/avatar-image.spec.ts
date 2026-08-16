import { BadRequestException } from '@nestjs/common';
import { MAX_AVATAR_BYTES, validateAvatarDataUrl } from './avatar-image';
import { updateAvatarSchema } from './preferences.schemas';

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

  it('accepts a valid PNG with exactly 5 MB', () => {
    const atLimit = Buffer.alloc(MAX_AVATAR_BYTES);
    Buffer.from(onePixelPng, 'base64').copy(atLimit);
    const image = `data:image/png;base64,${atLimit.toString('base64')}`;

    expect(updateAvatarSchema.safeParse({ image }).success).toBe(true);
    expect(validateAvatarDataUrl(image).data).toHaveLength(MAX_AVATAR_BYTES);
  });

  it('rejects an image larger than 5 MB', () => {
    const aboveLimit = Buffer.alloc(MAX_AVATAR_BYTES + 1);
    Buffer.from(onePixelPng, 'base64').copy(aboveLimit);

    expect(() => validateAvatarDataUrl(`data:image/png;base64,${aboveLimit.toString('base64')}`)).toThrow('A imagem deve ter no máximo 5 MB.');
  });
});
