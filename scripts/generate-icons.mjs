import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildDir = path.join(__dirname, '../build')
const svgPath = path.join(buildDir, 'icon.svg')
const iconsetDir = path.join(buildDir, 'icon.iconset')

// Icon sizes for macOS iconset
const sizes = [16, 32, 64, 128, 256, 512, 1024]

async function generateIcons() {
  console.log('Generating icons from SVG...')

  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath)

  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true })
  }

  // Generate PNGs at various sizes for macOS iconset
  for (const size of sizes) {
    // Regular resolution
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`))

    // @2x resolution (except for 1024 which is already max)
    if (size <= 512) {
      await sharp(svgBuffer)
        .resize(size * 2, size * 2)
        .png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`))
    }

    console.log(`  Generated ${size}x${size}`)
  }

  // Generate main icon.png (512x512) for general use
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(buildDir, 'icon.png'))
  console.log('  Generated icon.png (512x512)')

  // Generate Windows icon (256x256 PNG, will need to be converted to ICO)
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(buildDir, 'icon-256.png'))
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

  // Generate Linux icons (PNG at various sizes)
  for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(linuxIconsDir, `${size}x${size}.png`))
  }
  console.log('  Generated Linux icons')

  console.log('Done!')
}

generateIcons().catch(console.error)
