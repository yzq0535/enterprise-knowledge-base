/* 服务端照片处理：等比压缩 + 服务器时间水印（防止改手机时间） */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { UPLOAD_DIR } = require('./db');

const MAX_BYTES = 12 * 1024 * 1024;

function parseDataUrl(input) {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(input || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return buf;
}

async function saveCheckinPhoto(dataUrl, takenAt) {
  const src = parseDataUrl(dataUrl);
  if (!src) throw new Error('照片格式不正确或文件过大');

  const base = await sharp(src)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  const { width, height } = base.info;
  const fontSize = Math.max(16, Math.round(width * 0.03));
  const barH = Math.round(fontSize * 2.2);
  const label = `${takenAt}  CHECK-IN`;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barH}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.62)"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="${Math.round(fontSize * 0.66)}" y="${Math.round(barH * 0.62)}"
        font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="${fontSize}"
        font-weight="bold" fill="#ffffff" letter-spacing="0.5">${label}</text>
    </svg>`
  );

  const out = await sharp(base.data)
    .composite([{ input: svg, gravity: 'southwest' }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  const name = `${takenAt.slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), out);
  return { file: `uploads/${name}`, width, height, bytes: out.length };
}

function removePhoto(relPath) {
  if (!relPath) return;
  const abs = path.join(UPLOAD_DIR, path.basename(relPath));
  fs.rm(abs, { force: true }, () => {});
}

module.exports = { saveCheckinPhoto, removePhoto, parseDataUrl };
