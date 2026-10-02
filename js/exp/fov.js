// Campo de visión: shadowcasting recursivo (8 octantes)
const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

export function computeFOV(ox, oy, radius, opaque, visit) {
  visit(ox, oy, 0);
  for (let oct = 0; oct < 8; oct++) {
    castLight(ox, oy, 1, 1.0, 0.0, radius, MULT[0][oct], MULT[1][oct], MULT[2][oct], MULT[3][oct], opaque, visit);
  }
}

function castLight(cx, cy, row, start, end, radius, xx, xy, yx, yy, opaque, visit) {
  if (start < end) return;
  const r2 = radius * radius;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1;
    const dy = -j;
    let blocked = false;
    while (dx <= 0) {
      dx += 1;
      const X = cx + dx * xx + dy * xy;
      const Y = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) visit(X, Y, Math.sqrt(d2));
      if (blocked) {
        if (opaque(X, Y)) { newStart = rSlope; continue; }
        blocked = false; start = newStart;
      } else if (opaque(X, Y) && j < radius) {
        blocked = true;
        castLight(cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy, opaque, visit);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

// Línea de visión entre dos puntos (Bresenham, ignorando extremos)
export function hasLOS(x0, y0, x1, y1, opaque) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && opaque(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
