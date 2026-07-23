/**
 * Regenerates all PWA / favicon icons from a single source logo.
 *
 * Usage:  npm run icons
 *
 * Source logo:  public/brand/gst-favicon.png  (change SOURCE below if needed)
 * Outputs:
 *   public/icon-192x192.png    — PWA standard icon
 *   public/icon-512x512.png    — PWA large / maskable icon
 *   public/apple-touch-icon.png — iOS home screen icon (180x180)
 *   public/favicon.png          — browser tab icon
 *
 * Update your logo file, run `npm run icons`, commit, and every icon
 * across the site + installed PWA updates together.
 */
import sharp from "sharp";
import { existsSync } from "fs";
import path from "path";

const SOURCE = path.join(process.cwd(), "public/brand/gst-favicon.png");
const PUBLIC = path.join(process.cwd(), "public");

// Background behind the logo when padding to a square.
// Use a transparent background by setting alpha to 0.
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

const TARGETS = [
  { file: "icon-192x192.png", size: 192 },
  { file: "icon-512x512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "favicon.png", size: 96 },
];

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`✗ Source logo not found: ${SOURCE}`);
    process.exit(1);
  }

  const meta = await sharp(SOURCE).metadata();
  console.log(`Source: ${SOURCE} (${meta.width}x${meta.height})`);

  for (const { file, size } of TARGETS) {
    const out = path.join(PUBLIC, file);

    // Fit the logo inside the square with padding, so nothing gets cropped.
    await sharp(SOURCE)
      .resize(size, size, {
        fit: "contain",
        background: BG,
      })
      .flatten({ background: BG })
      .png()
      .toFile(out);

    console.log(`✓ ${file} (${size}x${size})`);
  }

  console.log("\nDone. Commit the updated icons to deploy them.");
}

main().catch((err) => {
  console.error("✗ Icon generation failed:", err);
  process.exit(1);
});
