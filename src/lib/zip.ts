// Minimal ZIP writer (store only, no compression)
// Supports creating small zip files in the browser without dependencies.

export interface ZipFileEntry {
  path: string
  content: Uint8Array
  date?: Date
}

const textEncoder = new TextEncoder()

function crc32(buf: Uint8Array): number {
  let c = ~0 >>> 0
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff]
  }
  return (~c) >>> 0
}

// Precompute CRC table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function dosDateTime(d: Date) {
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const seconds = Math.floor(d.getSeconds() / 2)
  const dosTime = (hours << 11) | (minutes << 5) | seconds
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosTime, dosDate }
}

export function createZip(entries: ZipFileEntry[]): Blob {
  const parts: Uint8Array[] = []
  const centralRecords: Uint8Array[] = []
  let offset = 0
  const now = new Date()

  for (const e of entries) {
    const nameBytes = textEncoder.encode(e.path)
    const data = e.content
    const crc = crc32(data)
    const { dosTime, dosDate } = dosDateTime(e.date || now)

    // Track the start offset of this local header
    const localHeaderOffset = offset

    // Local File Header
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true) // signature
    lh.setUint16(4, 20, true) // version needed to extract
    lh.setUint16(6, 0, true) // flags
    lh.setUint16(8, 0, true) // compression (0 = store)
    lh.setUint16(10, dosTime, true)
    lh.setUint16(12, dosDate, true)
    lh.setUint32(14, crc, true)
    lh.setUint32(18, data.length, true) // comp size
    lh.setUint32(22, data.length, true) // uncomp size
    lh.setUint16(26, nameBytes.length, true)
    lh.setUint16(28, 0, true) // extra len

    const lhBytes = new Uint8Array(lh.buffer)
    parts.push(lhBytes)
    parts.push(nameBytes)
    parts.push(data)

    // Update running offset to reflect bytes just pushed
    offset += lhBytes.length + nameBytes.length + data.length

    // Central Directory Record for this file
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true) // version made by
    cd.setUint16(6, 20, true) // version needed
    cd.setUint16(8, 0, true) // flags
    cd.setUint16(10, 0, true) // compression
    cd.setUint16(12, dosTime, true)
    cd.setUint16(14, dosDate, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, data.length, true)
    cd.setUint32(24, data.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint16(30, 0, true) // extra
    cd.setUint16(32, 0, true) // comment
    cd.setUint16(34, 0, true) // disk number start
    cd.setUint16(36, 0, true) // internal attrs
    cd.setUint32(38, 0, true) // external attrs
    cd.setUint32(42, localHeaderOffset, true)

    centralRecords.push(new Uint8Array(cd.buffer))
    centralRecords.push(nameBytes)
  }

  const centralDirOffset = offset
  const centralDirSize = centralRecords.reduce((s, u8) => s + u8.length, 0)

  // Append central directory
  for (const c of centralRecords) parts.push(c)
  offset += centralDirSize

  // End of Central Directory
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(4, 0, true) // disk number
  eocd.setUint16(6, 0, true) // disk start
  eocd.setUint16(8, entries.length, true)
  eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, centralDirSize, true)
  eocd.setUint32(16, centralDirOffset, true)
  eocd.setUint16(20, 0, true) // comment len

  parts.push(new Uint8Array(eocd.buffer))

  // Concatenate
  let total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return new Blob([out], { type: 'application/zip' })
}

export function utf8(str: string): Uint8Array {
  return textEncoder.encode(str)
}
