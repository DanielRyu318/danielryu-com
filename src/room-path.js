const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const xyz = a => ({ x: a[0], y: a[1], z: a[2] });
export const tuple = p => [p.x, p.y, p.z];

// Sample an interpolating spline and its arc length once, then run the steel ball at a consistent speed.
export function railPath(points) {
  const knots = points.filter((p, i) => !i || distance(p, points[i - 1]) > 0.0001);
  const samples = [knots[0]];
  const lengths = [0];
  for (let i = 0; i < knots.length - 1; i++) {
    const a = knots[Math.max(0, i - 1)], b = knots[i], c = knots[i + 1], d = knots[Math.min(knots.length - 1, i + 2)];
    for (let j = 1; j <= 12; j++) {
      const t = j / 12, t2 = t * t, t3 = t2 * t;
      const next = j === 12 ? c : b.map((v, k) => 0.5 * ((2 * v) + (c[k] - a[k]) * t
        + (2 * a[k] - 5 * v + 4 * c[k] - d[k]) * t2 + (3 * v - a[k] - 3 * c[k] + d[k]) * t3));
      lengths.push(lengths.at(-1) + distance(samples.at(-1), next));
      samples.push(next);
    }
  }
  const length = lengths.at(-1);
  function at(progress) {
    if (progress <= 0 || samples.length === 1) return xyz(samples[0]);
    if (progress >= 1) return xyz(samples.at(-1));
    const s = progress * length;
    let low = 0, high = lengths.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (lengths[mid] > s) high = mid;
      else low = mid;
    }
    const alpha = (s - lengths[low]) / (lengths[high] - lengths[low]);
    return xyz(samples[low].map((v, k) => v + (samples[high][k] - v) * alpha));
  }
  function firstProgress(predicate) {
    const i = samples.findIndex(predicate);
    return i < 0 || !length ? 0 : lengths[i] / length;
  }
  return { at, length, firstProgress };
}
