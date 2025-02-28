import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";

// Draws a shape based on type.
export function drawShape(ctx, shape, size) {
  const half = size / 2;
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(0, 0, half, 0, Math.PI * 2);
  } else if (shape === 'square') {
    ctx.rect(-half, -half, size, size);
  } else if (shape === 'triangle') {
    ctx.moveTo(0, -half);
    ctx.lineTo(-half, half);
    ctx.lineTo(half, half);
    ctx.closePath();
  } else if (shape === 'star') {
    let spikes = 5;
    let outerRadius = half;
    let innerRadius = outerRadius / 2;
    let rot = Math.PI / 2 * 3;
    ctx.moveTo(0, -outerRadius);
    let step = Math.PI / spikes;
    for (let i = 0; i < spikes; i++) {
      const x = Math.cos(rot) * outerRadius;
      const y = Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
      rot += step;
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

export function drawShield(ctx, shape, size, offset) {
  const half = size / 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#00ffff';
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, half + offset, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'square') {
    ctx.beginPath();
    ctx.rect(-half - offset, -half - offset, size + 2 * offset, size + 2 * offset);
    ctx.stroke();
  } else if (shape === 'triangle') {
    const A = { x: 0, y: -half };
    const B = { x: -half, y: half };
    const C = { x: half, y: half };
    function computeOffsetVertex(P, Pprev, Pnext, offset) {
      let v1 = { x: Pprev.x - P.x, y: Pprev.y - P.y };
      let v2 = { x: Pnext.x - P.x, y: Pnext.y - P.y };
      let mag1 = Math.hypot(v1.x, v1.y);
      let mag2 = Math.hypot(v2.x, v2.y);
      v1.x /= mag1; v1.y /= mag1;
      v2.x /= mag2; v2.y /= mag2;
      let bisector = { x: v1.x + v2.x, y: v1.y + v2.y };
      let magBis = Math.hypot(bisector.x, bisector.y);
      if (magBis === 0) return { x: P.x, y: P.y };
      bisector.x /= magBis; bisector.y /= magBis;
      let dot = v1.x * v2.x + v1.y * v2.y;
      dot = Math.min(1, Math.max(-1, dot));
      let angle = Math.acos(dot);
      let factor = offset / Math.sin(angle / 2);
      return { x: P.x - factor * bisector.x, y: P.y - factor * bisector.y };
    }
    const A_off = computeOffsetVertex(A, B, C, offset);
    const B_off = computeOffsetVertex(B, C, A, offset);
    const C_off = computeOffsetVertex(C, A, B, offset);
    ctx.beginPath();
    ctx.moveTo(A_off.x, A_off.y);
    ctx.lineTo(B_off.x, B_off.y);
    ctx.lineTo(C_off.x, C_off.y);
    ctx.closePath();
    ctx.stroke();
  }
}

// Collision and geometry helpers.
export function getVertices(entity) {
  let vertices = [];
  const { x, y, size, shape } = entity;
  if (shape === 'square') {
    const half = size / 2;
    vertices.push({ x: x - half, y: y - half });
    vertices.push({ x: x + half, y: y - half });
    vertices.push({ x: x + half, y: y + half });
    vertices.push({ x: x - half, y: y + half });
  } else if (shape === 'triangle') {
    const half = size / 2;
    vertices.push({ x: x, y: y - half });
    vertices.push({ x: x - half, y: y + half });
    vertices.push({ x: x + half, y: y + half });
  }
  return vertices;
}

function projectPolygon(axis, poly) {
  let min = poly[0].x * axis.x + poly[0].y * axis.y;
  let max = min;
  for (let i = 1; i < poly.length; i++) {
    const proj = poly[i].x * axis.x + poly[i].y * axis.y;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return { min, max };
}

function polygonCollision(polyA, polyB) {
  const polygons = [polyA, polyB];
  for (let polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      let axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      let len = Math.hypot(axis.x, axis.y);
      if (len === 0) continue;
      axis.x /= len;
      axis.y /= len;
      const projA = projectPolygon(axis, polyA);
      const projB = projectPolygon(axis, polyB);
      if (projA.max < projB.min || projB.max < projA.min) {
        return false;
      }
    }
  }
  return true;
}

function pointInPolygon(point, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(point, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  let t = ((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y);
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

function circlePolygonCollision(circle, poly) {
  if (pointInPolygon({ x: circle.x, y: circle.y }, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const closest = closestPointOnSegment({ x: circle.x, y: circle.y }, a, b);
    const dx = circle.x - closest.x;
    const dy = circle.y - closest.y;
    if ((dx * dx + dy * dy) <= (circle.r * circle.r)) return true;
  }
  return false;
}

export function refinedCollisionDetection(a, b) {
  const buffer = 3;
  const validPolygonShapes = ['square', 'triangle'];
  const aIsCircle = (a.shape === 'circle') || !validPolygonShapes.includes(a.shape);
  const bIsCircle = (b.shape === 'circle') || !validPolygonShapes.includes(b.shape);

  if (aIsCircle && bIsCircle) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rA = a.size / 2;
    const rB = b.size / 2;
    return (dx * dx + dy * dy) <= ((rA + rB + buffer) ** 2);
  }
  if (aIsCircle && !bIsCircle) {
    const circle = { x: a.x, y: a.y, r: a.size / 2 + buffer };
    const poly = getVertices(b);
    return circlePolygonCollision(circle, poly);
  }
  if (bIsCircle && !aIsCircle) {
    const circle = { x: b.x, y: b.y, r: b.size / 2 + buffer };
    const poly = getVertices(a);
    return circlePolygonCollision(circle, poly);
  }
  const polyA = getVertices(a);
  const polyB = getVertices(b);
  return polygonCollision(polyA, polyB);
}
