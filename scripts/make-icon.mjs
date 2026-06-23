// Generates build/icon.ico from the app emoji by rendering it to PNGs of
// several sizes (via an offscreen Electron window's canvas) and packing them
// into a single multi-resolution .ico. Run with: npm run icon
import { app, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_ICON_SVG } from '../src/renderer/components/icon.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SIZES = [16, 24, 32, 48, 64, 128, 256]
const SVG_DATA_URL = 'data:image/svg+xml;base64,' + Buffer.from(APP_ICON_SVG).toString('base64')

function packIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4)
  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  const blobs = []
  images.forEach((img, i) => {
    const e = i * 16
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 0) // width (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1) // height
    dir.writeUInt8(0, e + 2) // palette
    dir.writeUInt8(0, e + 3) // reserved
    dir.writeUInt16LE(1, e + 4) // color planes
    dir.writeUInt16LE(32, e + 6) // bits per pixel
    dir.writeUInt32LE(img.buf.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += img.buf.length
    blobs.push(img.buf)
  })
  return Buffer.concat([header, dir, ...blobs])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 300, height: 300 })
  await win.loadURL('data:text/html,<body></body>')
  const images = []
  for (const size of SIZES) {
    const dataUrl = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const size = ${size}
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = c.height = size
          const x = c.getContext('2d')
          x.clearRect(0, 0, size, size)
          x.drawImage(img, 0, 0, size, size)
          resolve(c.toDataURL('image/png'))
        }
        img.onerror = () => resolve(null)
        img.src = ${JSON.stringify(SVG_DATA_URL)}
      })
    `)
    if (!dataUrl) throw new Error('failed to rasterize SVG at size ' + size)
    images.push({ size, buf: Buffer.from(dataUrl.split(',')[1], 'base64') })
  }
  const outDir = join(__dirname, '..', 'build')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'icon.ico'), packIco(images))
  console.log('Wrote build/icon.ico (' + SIZES.join(', ') + ')')
  app.quit()
})
