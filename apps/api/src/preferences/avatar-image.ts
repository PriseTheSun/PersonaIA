import { BadRequestException } from '@nestjs/common';

export const MAX_AVATAR_BYTES = 700 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_777_216;
const JPEG_START_OF_FRAME = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export type ValidatedAvatar = {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
};

function invalidImage(message = 'A imagem não é um PNG ou JPEG válido.') {
  return new BadRequestException({ code: 'INVALID_AVATAR', message });
}

function pngDimensions(data: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 24 || !data.subarray(0, 8).equals(signature) || data.toString('ascii', 12, 16) !== 'IHDR') {
    throw invalidImage();
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function jpegDimensions(data: Buffer) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw invalidImage();
  let offset = 2;
  while (offset + 4 <= data.length) {
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > data.length) break;
    const segmentLength = data.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > data.length) break;
    if (JPEG_START_OF_FRAME.has(marker) && segmentLength >= 7) {
      return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
    }
    offset += segmentLength;
  }
  throw invalidImage();
}

function validateDimensions(width: number, height: number) {
  if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw invalidImage('Use uma imagem de até 4096 × 4096 pixels.');
  }
}

export function validateAvatarDataUrl(image: string): ValidatedAvatar {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) throw invalidImage('Use uma imagem PNG ou JPEG.');
  const mimeType = match[1] as ValidatedAvatar['mimeType'];
  const encoded = match[2];
  if (!encoded || encoded.length % 4 !== 0) throw invalidImage();
  const data = Buffer.from(encoded, 'base64');
  if (data.length === 0 || data.toString('base64') !== encoded) throw invalidImage();
  if (data.length > MAX_AVATAR_BYTES) {
    throw invalidImage('A imagem deve ter no máximo 700 KB.');
  }
  const dimensions = mimeType === 'image/png' ? pngDimensions(data) : jpegDimensions(data);
  validateDimensions(dimensions.width, dimensions.height);
  return { data, mimeType, ...dimensions };
}
