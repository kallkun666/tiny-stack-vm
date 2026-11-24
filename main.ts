import { mkdirSync as md, readdirSync as rd, readFileSync as rf, writeFileSync as wf } from 'node:fs';
import { join } from 'node:path';

// Packed metadata: (imm << 4) | (pops << 2) | pushes; -1 = invalid
const T = new Int8Array(84).fill(-1);
for (let i = 16; i < 35; i++) if (i !== 31) T[i] = i === 23 || i === 27 ? 5 : 9;
T.set([0,17,65,4,6,10,11,15]); T.set([32,36,36,32,0], 48); T.set([5,8], 64); T.set([4,4,1,4], 80);

function run(p: Uint8Array, q: Uint8Array) {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), B = new Uint8Array(65536);
  let s = 0, c = 0, o = 0, i = 0, pc = 0, k = 0;
  const r = (e: number): [Uint8Array, number] => [B.subarray(0, o), e];
  const u16 = (x: number) => p[x] | p[x + 1] << 8;

  for (;;) {
    if (k === 1e6) return r(10);
    if (pc < 0 || pc >= n) return r(9);
    const op = p[pc], m = op < 84 ? T[op] : -1;
    if (m < 0) return r(5);
    const imm = m >> 4, pop = m >> 2 & 3;
    if (pc + imm >= n) return r(9);
    k++;
    if (s < pop) return r(2);
    if (s - pop + (m & 3) > 256) return r(3);
    pc += 1 + imm;

    if (m === 9) {
      const a = D[s - 2], b = D[s - 1], u = a >>> 0, v = b >>> 0;
      if (op > 18 && op < 23 && !b) return r(4);
      D[--s - 1] = op < 24
        ? op === 16 ? a + b : op === 17 ? a - b : op === 18 ? Math.imul(a, b)
        : op === 19 ? (a === 1 << 31 && b === -1 ? a : a / b | 0)
        : op === 20 ? (b === -1 ? 0 : a % b) : op === 21 ? u / v | 0 : u % v
        : op === 24 ? a & b : op === 25 ? a | b : op === 26 ? a ^ b
        : op === 28 ? a << b : op === 29 ? a >> b : op === 30 ? a >>> b
        : op === 32 ? +(a === b) : op === 33 ? +(a < b) : +(u < v);
      continue;
    }

    switch (op) {
      case 0: return r(0);
      case 1: D[s++] = p[pc - 1] << 24 >> 24; break;
      case 2: D[s++] = u16(pc - 4) | u16(pc - 2) << 16; break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: [D[s - 2], D[s - 1]] = [D[s - 1], D[s - 2]]; break;
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: [D[s - 3], D[s - 2], D[s - 1]] = [D[s - 2], D[s - 1], D[s - 3]]; break;
      case 23: D[s - 1] = -D[s - 1]; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 48: case 49: case 50: if (op === 48 || (op === 49) === !D[--s]) pc += u16(pc - 2) << 16 >> 16; break;
      case 51: if (c === 64) return r(7); C[c++] = pc; pc = u16(pc - 2); break;
      case 52: if (!c) return r(8); pc = C[--c]; break;
      case 64: case 65: {
        const a = D[s - 1];
        if (a & ~255) return r(6);
        if (op === 64) D[s - 1] = M[a]; else { M[a] = D[s - 2]; s -= 2; }
        break;
      }
      case 80: {
        const w = Buffer.from('' + D[s - 1]);
        if (o + w.length > 65536) return r(11);
        B.set(w, o); o += w.length; s--; break;
      }
      case 81: if (o === 65536) return r(11); B[o++] = D[--s]; break;
      case 82: D[s++] = i < q.length ? q[i++] : -1; break;
      case 83: return r(D[--s] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input', O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of rd(I).sort()) {
  const [out, e] = run(rf(join(I, id, 'program.bin')), rf(join(I, id, 'input.bin')));
  const d = join(O, id);
  md(d, { recursive: true });
  wf(join(d, 'stdout.bin'), out);
  wf(join(d, 'exit.txt'), e + '\n');
}
