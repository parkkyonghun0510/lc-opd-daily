import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICON_SIZES = [
  72,
  96,
  128,
  144,
  152,
  192,
  384,
  512
];

async function generateIcons() {
  try {
    // Create icons directory if it doesn't exist
    await fs.mkdir(path.join(process.cwd(), 'public', 'icons'), { recursive: true });

    const sourceImage = path.join(process.cwd(), 'public', 'lc-logo.png');

    // Generate icons for each size
    for (const size of ICON_SIZES) {
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(path.join(process.cwd(), 'public', 'icons', `icon-${size}x${size}.png`));
      
      console.log(`Generated ${size}x${size} icon`);
    }

    // Generate special icons for shortcuts
    await sharp(sourceImage)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile(path.join(process.cwd(), 'public', 'icons', 'new-report.png'));

    await sharp(sourceImage)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile(path.join(process.cwd(), 'public', 'icons', 'reports.png'));

    console.log('Generated shortcut icons');
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons(); 