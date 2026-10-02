// Compresión LZ para el guardado en localStorage (algoritmo de lz-string, versión UTF-16).
// Cada carácter de salida guarda 15 bits: apto para localStorage, que almacena UTF-16.
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function compress(input, bitsPerChar, toChar) {
  if (input == null) return '';
  const dict = {}, toCreate = {};
  let w = '', enlargeIn = 2, dictSize = 3, numBits = 2;
  const out = [];
  let val = 0, pos = 0;
  const writeBits = (value, n) => {
    for (let i = 0; i < n; i++) {
      val = (val << 1) | (value & 1);
      if (pos === bitsPerChar - 1) { pos = 0; out.push(toChar(val)); val = 0; } else pos++;
      value >>= 1;
    }
  };
  const emitW = () => {
    if (has(toCreate, w)) {
      const code = w.charCodeAt(0);
      if (code < 256) { writeBits(0, numBits); writeBits(code, 8); }
      else { writeBits(1, numBits); writeBits(code, 16); }
      if (--enlargeIn === 0) { enlargeIn = 2 ** numBits; numBits++; }
      delete toCreate[w];
    } else writeBits(dict[w], numBits);
    if (--enlargeIn === 0) { enlargeIn = 2 ** numBits; numBits++; }
  };
  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);
    if (!has(dict, c)) { dict[c] = dictSize++; toCreate[c] = true; }
    const wc = w + c;
    if (has(dict, wc)) w = wc;
    else {
      emitW();
      dict[wc] = dictSize++;
      w = c;
    }
  }
  if (w !== '') emitW();
  writeBits(2, numBits);
  for (;;) {
    val <<= 1;
    if (pos === bitsPerChar - 1) { out.push(toChar(val)); break; }
    pos++;
  }
  return out.join('');
}

function decompress(length, resetValue, getNext) {
  const dict = [0, 1, 2];
  let enlargeIn = 4, dictSize = 4, numBits = 3;
  const result = [];
  const data = { val: getNext(0), position: resetValue, index: 1 };
  const readBits = (n) => {
    let bits = 0, power = 1;
    const max = 2 ** n;
    while (power !== max) {
      const resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) { data.position = resetValue; data.val = getNext(data.index++); }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return bits;
  };
  let c;
  switch (readBits(2)) {
    case 0: c = String.fromCharCode(readBits(8)); break;
    case 1: c = String.fromCharCode(readBits(16)); break;
    default: return '';
  }
  dict[3] = c;
  let w = c;
  result.push(c);
  for (;;) {
    if (data.index > length) return '';
    let code = readBits(numBits);
    if (code === 0 || code === 1) {
      dict[dictSize++] = String.fromCharCode(readBits(code === 0 ? 8 : 16));
      code = dictSize - 1;
      enlargeIn--;
    } else if (code === 2) return result.join('');
    if (enlargeIn === 0) { enlargeIn = 2 ** numBits; numBits++; }
    let entry;
    if (dict[code] !== undefined) entry = dict[code];
    else if (code === dictSize) entry = w + w.charAt(0);
    else return null;
    result.push(entry);
    dict[dictSize++] = w + entry.charAt(0);
    enlargeIn--;
    w = entry;
    if (enlargeIn === 0) { enlargeIn = 2 ** numBits; numBits++; }
  }
}

export function compressToUTF16(s) {
  return compress(s, 15, (a) => String.fromCharCode(a + 32)) + ' ';
}
export function decompressFromUTF16(s) {
  if (s == null) return '';
  if (s === '') return null;
  return decompress(s.length, 16384, (i) => s.charCodeAt(i) - 32);
}
