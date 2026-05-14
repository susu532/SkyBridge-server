import { encode, decode } from '@msgpack/msgpack';

export function encodePacket(event: string, args: any[]): Buffer | ArrayBuffer {
  // If args is exclusively a single buffer (binary mode)
  if (args.length === 1 && (args[0] instanceof ArrayBuffer || args[0] instanceof Float32Array || args[0] instanceof Uint16Array || Buffer.isBuffer(args[0]))) {
     const len = Buffer.byteLength(event);
     const header = Buffer.alloc(1 + len);
     header.writeUInt8(len, 0);
     header.write(event, 1, len);
     if (Buffer.isBuffer(args[0])) {
         return Buffer.concat([header, args[0]]);
     } else {
         return Buffer.concat([header, Buffer.from(args[0] instanceof ArrayBuffer ? args[0] : (args[0] as ArrayBufferView).buffer)]);
     }
  }

  // msgpack mode
  // Use a special prefix byte (e.g. 255) to indicate msgpack to distinguish from raw binary which has < 50 length
  const encoded = encode({ e: event, a: args });
  const buf = Buffer.alloc(1 + encoded.length);
  buf.writeUInt8(255, 0); // MSGPack prefix
  buf.set(encoded, 1);
  return buf;
}

export function decodePacket(data: Buffer | ArrayBuffer | string): { event: string, args: any[] } | null {
  if (typeof data === 'string') {
     try {
       const d = JSON.parse(data);
       return { event: d.e, args: d.a };
     } catch(e) { return null; }
  } else {
     const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
     if (buf.length > 0 && buf[0] === 255) { // msgpack mode
        try {
          const d = decode(buf.slice(1)) as any;
          return { event: d.e, args: d.a };
        } catch(e) { return null; }
     } else if (buf.length > 0 && buf[0] < 50) { // Binary packet with length prefix
        const len = buf.readUInt8(0);
        const event = buf.toString('utf8', 1, 1 + len);
        const bufferBase = buf.slice(1 + len);
        return { event, args: [bufferBase] };
     } else {
        try { // Legacy JSON fallback
          const d = JSON.parse(buf.toString('utf8'));
          return { event: d.e, args: d.a };
        } catch(e) { return null; }
     }
  }
}

