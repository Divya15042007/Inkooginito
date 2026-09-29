import { Point, Stroke } from '../types/drawing';

/**
 * Calculates distance between two points
 */
export function getDistance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Smoothes points using Catmull-Rom or Bezier subdivision
 */
export function smoothPoints(rawPoints: Point[]): Point[] {
  if (rawPoints.length <= 2) return rawPoints;
  const smoothed: Point[] = [rawPoints[0]];

  for (let i = 1; i < rawPoints.length - 1; i++) {
    const prev = rawPoints[i - 1];
    const curr = rawPoints[i];
    const next = rawPoints[i + 1];

    // Midpoints
    const mid1 = {
      x: (prev.x + curr.x) / 2,
      y: (prev.y + curr.y) / 2,
      pressure: (prev.pressure + curr.pressure) / 2
    };
    const mid2 = {
      x: (curr.x + next.x) / 2,
      y: (curr.y + next.y) / 2,
      pressure: (curr.pressure + next.pressure) / 2
    };

    smoothed.push(mid1, curr, mid2);
  }

  smoothed.push(rawPoints[rawPoints.length - 1]);
  return smoothed;
}

/**
 * Renders a stroke onto a canvas 2D context with full pressure sensitivity and styling
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  colorOverride?: string
) {
  const { points, tool, size } = stroke;
  const strokeColor = colorOverride || stroke.color;

  if (points.length === 0) return;

  ctx.save();

  // Tool specific configurations
  if (tool === 'highlighter') {
    ctx.globalAlpha = 0.45;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
  } else if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // Handle Shapes
  if (['rect', 'circle', 'arrow', 'line'].includes(tool)) {
    if (points.length < 2) {
      ctx.restore();
      return;
    }
    const start = points[0];
    const end = points[points.length - 1];

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = size;

    if (tool === 'rect') {
      const width = end.x - start.x;
      const height = end.y - start.y;
      ctx.strokeRect(start.x, start.y, width, height);
    } else if (tool === 'circle') {
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (tool === 'arrow') {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = Math.max(12, size * 2.5);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle - Math.PI / 6),
        end.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle + Math.PI / 6),
        end.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  // Single point / dot
  if (points.length === 1) {
    const p = points[0];
    const dynamicRadius = Math.max(1, (size * (0.3 + 0.7 * (p.pressure || 0.5))) / 2);
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, dynamicRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Calligraphy brush (angled chisel ribbon)
  if (tool === 'calligraphy') {
    ctx.fillStyle = strokeColor;
    const angle = Math.PI / 4; // 45 degree angle
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const rad1 = Math.max(2, size * (0.4 + 0.6 * (p1.pressure || 0.5)));
      const rad2 = Math.max(2, size * (0.4 + 0.6 * (p2.pressure || 0.5)));

      ctx.beginPath();
      ctx.moveTo(p1.x - dx * rad1, p1.y - dy * rad1);
      ctx.lineTo(p1.x + dx * rad1, p1.y + dy * rad1);
      ctx.lineTo(p2.x + dx * rad2, p2.y + dy * rad2);
      ctx.lineTo(p2.x - dx * rad2, p2.y - dy * rad2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Brush (soft feathered edge)
  if (tool === 'brush') {
    ctx.strokeStyle = strokeColor;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const pressure = (p1.pressure + p2.pressure) / 2 || 0.5;
      const dynamicWidth = Math.max(2, size * (0.3 + 0.8 * pressure));

      ctx.lineWidth = dynamicWidth;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Highlighter & Standard Pen with smooth variable width interpolation
  ctx.strokeStyle = strokeColor;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    // Smooth quadratic curve midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const pressure = (p1.pressure + p2.pressure) / 2 || 0.5;
    const dynamicWidth = tool === 'highlighter' 
      ? size * 2.2 
      : Math.max(1.5, size * (0.25 + 0.85 * pressure));

    ctx.lineWidth = dynamicWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Checks if a point (x, y) is near any segment of a stroke within tolerance distance
 */
export function isPointNearStroke(stroke: Stroke, x: number, y: number, tolerance = 12): boolean {
  const { points, size } = stroke;
  const effectiveTolerance = Math.max(tolerance, size / 2 + 6);

  if (points.length === 1) {
    return Math.hypot(points[0].x - x, points[0].y - y) <= effectiveTolerance;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = distToSegment({ x, y }, p1, p2);
    if (dist <= effectiveTolerance) return true;
  }

  return false;
}

function distToSegment(p: { x: number; y: number }, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * Finds the top-most stroke under coordinate (x, y)
 */
export function findStrokeAtPoint(strokes: Stroke[], x: number, y: number, tolerance = 10): Stroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (isPointNearStroke(strokes[i], x, y, tolerance)) {
      return strokes[i];
    }
  }
  return null;
}

/**
 * Exports strokes to clean SVG string with path definitions & author metadata
 */
export function exportToSVG(strokes: Stroke[], width: number, height: number, backgroundColor?: string): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  
  if (backgroundColor && backgroundColor !== 'transparent') {
    svg += `  <rect width="100%" height="100%" fill="${backgroundColor}" />\n`;
  }

  strokes.forEach((stroke) => {
    const { points, color, size, tool, authorName } = stroke;
    if (points.length === 0) return;

    const opacity = tool === 'highlighter' ? '0.5' : '1.0';
    let pathData = '';

    if (['rect', 'circle', 'arrow', 'line'].includes(tool)) {
      if (points.length >= 2) {
        const p1 = points[0];
        const p2 = points[points.length - 1];
        if (tool === 'rect') {
          const w = p2.x - p1.x;
          const h = p2.y - p1.y;
          svg += `  <rect x="${Math.min(p1.x, p2.x)}" y="${Math.min(p1.y, p2.y)}" width="${Math.abs(w)}" height="${Math.abs(h)}" stroke="${color}" stroke-width="${size}" fill="none" data-author="${authorName}" />\n`;
        } else if (tool === 'circle') {
          const rx = Math.abs(p2.x - p1.x) / 2;
          const ry = Math.abs(p2.y - p1.y) / 2;
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          svg += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${color}" stroke-width="${size}" fill="none" data-author="${authorName}" />\n`;
        } else {
          svg += `  <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${size}" stroke-linecap="round" data-author="${authorName}" />\n`;
        }
      }
      return;
    }

    if (points.length === 1) {
      pathData = `M ${points[0].x} ${points[0].y} A 1 1 0 0 1 ${points[0].x + 0.1} ${points[0].y}`;
    } else {
      pathData = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const midX = (points[i - 1].x + points[i].x) / 2;
        const midY = (points[i - 1].y + points[i].y) / 2;
        pathData += ` Q ${points[i - 1].x} ${points[i - 1].y}, ${midX} ${midY}`;
      }
      pathData += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    }

    svg += `  <path d="${pathData}" stroke="${color}" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}" data-author="${authorName}" />\n`;
  });

  svg += '</svg>';
  return svg;
}
