import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildDir = path.join(__dirname, '../build')
const sourcePath = path.join(buildDir, 'icon-source.png')
const iconsetDir = path.join(buildDir, 'icon.iconset')

// Icon sizes for macOS iconset
const sizes = [16, 32, 64, 128, 256, 512, 1024]

// Create macOS Big Sur style squircle mask SVG
function createSquircleMask(size) {
  // macOS Big Sur uses a superellipse (squircle) with specific corner radius
  // The radius is approximately 22.37% of the icon size
  const r = Math.round(size * 0.2237)
  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>
    </svg>
  `)
}

async function generateIcons() {
  console.log('Generating icons from source image...')

  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    console.error('Source image not found:', sourcePath)
    process.exit(1)
  }

  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true })
  }

  // Helper function to create masked icon at a specific size
  async function createMaskedIcon(size) {
    const mask = createSquircleMask(size)

    // Scale the source image larger than target, then crop to fill more space
    // This effectively "zooms in" on the icon to make it bigger
    const scaleFactor = 1.15  // 15% larger to fill the space better
    const scaledSize = Math.round(size * scaleFactor)
    const offset = Math.round((scaledSize - size) / 2)

    const resized = await sharp(sourcePath)
      .resize(scaledSize, scaledSize, { fit: 'cover' })
      .extract({ left: offset, top: offset, width: size, height: size })
      .toBuffer()

    // Apply mask to create transparent corners
    return sharp(resized)
      .composite([{
        input: mask,
        blend: 'dest-in'
      }])
      .png()
      .toBuffer()
  }

  // Generate PNGs at various sizes for macOS iconset
  for (const size of sizes) {
    // Regular resolution
    const iconBuffer = await createMaskedIcon(size)
    await sharp(iconBuffer).toFile(path.join(iconsetDir, `icon_${size}x${size}.png`))

    // @2x resolution (except for 1024 which is already max)
    if (size <= 512) {
      const icon2xBuffer = await createMaskedIcon(size * 2)
      await sharp(icon2xBuffer).toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`))
    }

    console.log(`  Generated ${size}x${size}`)
  }

  // Generate main icon.png (512x512) for general use
  const mainIconBuffer = await createMaskedIcon(512)
  await sharp(mainIconBuffer).toFile(path.join(buildDir, 'icon.png'))
  console.log('  Generated icon.png (512x512)')

  // Generate Windows icon (256x256 PNG with mask)
  const winIconBuffer = await createMaskedIcon(256)
  await sharp(winIconBuffer).toFile(path.join(buildDir, 'icon-256.png'))
  console.log('  Generated icon-256.png for Windows')

  // On macOS, convert iconset to icns using iconutil
  if (process.platform === 'darwin') {
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`)
      console.log('  Generated icon.icns')
    } catch (error) {
      console.error('  Failed to generate icon.icns:', error.message)
    }
  }

  // Create Linux icons directory
  const linuxIconsDir = path.join(buildDir, 'icons')
  if (!fs.existsSync(linuxIconsDir)) {
    fs.mkdirSync(linuxIconsDir, { recursive: true })
  }

  // Generate Linux icons (PNG at various sizes with mask)
  for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    const linuxIconBuffer = await createMaskedIcon(size)
    await sharp(linuxIconBuffer).toFile(path.join(linuxIconsDir, `${size}x${size}.png`))
  }
  console.log('  Generated Linux icons')

  console.log('Done!')
}

generateIcons().catch(console.error)
