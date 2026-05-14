export function encodeRLE(arr: Uint16Array): Uint16Array {
  const out: number[] = [];
  let count = 1;
  let pV = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === pV && count < 65535) count++;
    else {
      out.push(count);
      out.push(pV);
      pV = arr[i];
      count = 1;
    }
  }
  out.push(count);
  out.push(pV);
  return new Uint16Array(out);
}

export function decodeRLE(arr: Uint16Array, out: Uint16Array) {
  let ptr = 0;
  for (let i = 0; i < arr.length; i += 2) {
    const count = arr[i];
    const val = arr[i + 1];
    out.fill(val, ptr, ptr + count);
    ptr += count;
  }
}
