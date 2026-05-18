import sharp from 'sharp';

type EnhanceOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

function parseDataUrl(input: string) {
  const match = input.match(DATA_URL_REGEX);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function enhanceMarketplaceImage(
  input: string,
  options: EnhanceOptions = {}
): Promise<string> {
  const parsed = parseDataUrl(input);
  if (!parsed) return input;

  const { maxWidth = 1600, maxHeight = 1600, quality = 82 } = options;

  try {
    const enhanced = await sharp(parsed.buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .normalize()
      .modulate({ brightness: 1.03, saturation: 1.08 })
      .sharpen({ sigma: 1.1, m1: 0.8, m2: 2, x1: 2, y2: 10, y3: 20 })
      .webp({ quality })
      .toBuffer();

    return `data:image/webp;base64,${enhanced.toString('base64')}`;
  } catch (error) {
    console.error('[image-processing] Failed to enhance image', error);
    return input;
  }
}

export async function enhanceMarketplaceImages(
  inputs: unknown,
  options: EnhanceOptions = {}
): Promise<string[]> {
  if (!Array.isArray(inputs)) return [];

  const results = await Promise.all(
    inputs
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .slice(0, 5)
      .map((value) => enhanceMarketplaceImage(value, options))
  );

  return results;
}
