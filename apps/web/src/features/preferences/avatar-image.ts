import type { Area } from 'react-easy-crop';

const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = 16_777_216;
const MAX_OUTPUT_DIMENSION = 1024;

export class AvatarImageError extends Error {
  constructor(public readonly code: 'INVALID_IMAGE' | 'IMAGE_DIMENSIONS') {
    super(code);
  }
}

export async function readAvatarImage(file: File) {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl).catch(() => {
    throw new AvatarImageError('INVALID_IMAGE');
  });
  const { naturalWidth: width, naturalHeight: height } = image;
  if (width < 1 || height < 1 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new AvatarImageError('IMAGE_DIMENSIONS');
  }
  return dataUrl;
}

export async function cropImageToDataUrl(source: string, area: Area) {
  const image = await loadImage(source);
  const cropWidth = Math.max(1, Math.min(area.width, image.naturalWidth - area.x));
  const cropHeight = Math.max(1, Math.min(area.height, image.naturalHeight - area.y));
  const outputSize = Math.max(1, Math.min(MAX_OUTPUT_DIMENSION, Math.round(Math.min(cropWidth, cropHeight))));
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new AvatarImageError('INVALID_IMAGE');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(
    image,
    Math.max(0, area.x),
    Math.max(0, area.y),
    cropWidth,
    cropHeight,
    0,
    0,
    outputSize,
    outputSize,
  );
  return canvas.toDataURL('image/jpeg', 0.9);
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new AvatarImageError('INVALID_IMAGE'));
    reader.onerror = () => reject(new AvatarImageError('INVALID_IMAGE'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AvatarImageError('INVALID_IMAGE'));
    image.src = source;
  });
}
