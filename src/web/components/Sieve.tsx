/**
 * The sieve: the whole pipeline as a stack of shelves. Every grain is a real
 * record; each shelf catches what went no further. Plays once per browser
 * session, then (and under reduced motion) shows its settled state.
 */
import { useEffect, useRef, useState } from "react";
import type { Memory } from "../../core/schema";

export interface SieveLayer {
  label: string;
  n: number;
}

/** The shelves, from what the lab read down to what still stands. Counts come from stored records. */
export function sieveLayers(m: Memory): SieveLayer[] {
  const examined = m.runs.filter((r) => r.mode !== "collector").reduce((t, r) => t + r.counts.sourcesExamined, 0);
  const ideas = m.ideas.filter((i) => i.status !== "merged");
  const withExperiment = ideas.filter((i) => m.experiments.some((x) => x.ideaId === i.id));
  return [
    { label: "Sources read", n: Math.max(examined, m.sources.length) },
    { label: "Kept, with a verbatim quote", n: m.sources.length },
    { label: "Ideas proposed", n: ideas.length },
    { label: "Reached an experiment", n: withExperiment.length },
    { label: "Advanced", n: ideas.filter((i) => i.status === "advanced").length },
  ];
}

const MAX_GRAINS = 320;
const PLAYED_KEY = "venture.sieve.played";

interface Grain {
  x: number;
  y: number;
  ty: number;
  delay: number;
  layer: number;
  vy: number;
}

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function Sieve({ layers }: { layers: SieveLayer[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  // A grain caught on shelf i stands for one record that went no further.
  const caught = layers.map((l, i) => Math.max(0, l.n - (layers[i + 1]?.n ?? 0)));
  const total = caught.reduce((a, b) => a + b, 0);
  const scale = total > MAX_GRAINS ? Math.ceil(caught[0] / Math.max(1, MAX_GRAINS - (total - caught[0]))) : 1;

  useEffect(() => {
    const cv = ref.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    let raf = 0;
    let grains: Grain[] = [];
    let W = 0;
    const H = 320;
    const shelfY = (i: number) => 64 + i * ((H - 84) / (layers.length - 1));
    const left = () => (W < 520 ? 44 : 64);
    const right = () => (W < 520 ? W - 12 : W - 220);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let played = false;
    try {
      played = sessionStorage.getItem(PLAYED_KEY) === "1" && run === 0;
      sessionStorage.setItem(PLAYED_KEY, "1");
    } catch {
      /* no storage: play */
    }
    const settled = reduce || played;

    const build = () => {
      W = box.clientWidth;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = 40;
      const piles = layers.map(() => new Array(cols).fill(0));
      const span = right() - left();
      grains = [];
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      caught.forEach((c, li) => {
        const count = li === 0 ? Math.ceil(c / scale) : c;
        for (let k = 0; k < count; k++) {
          const last = li === layers.length - 1;
          // Survivors stand apart in the middle of the last shelf; the rest heap up.
          const col = last ? Math.round(cols / 2 + (k - (count - 1) / 2) * 2) : Math.floor(rnd() * cols);
          const h = piles[li][col]++;
          const x = left() + ((col + 0.5) / cols) * span;
          const r = last ? 7 : li === 0 ? 2.4 : 3.4;
          const ty = shelfY(li) - r - 1 - (last ? 0 : h * (r * 1.7));
          grains.push({ x: x + (last ? 0 : (rnd() - 0.5) * 4), y: -20 - rnd() * 160, ty, delay: rnd() * 700 + li * 260, layer: li, vy: 0 });
        }
      });
      if (settled) grains.forEach((g) => (g.y = g.ty));
    };

    const draw = (t0: number) => (now: number) => {
      const t = now - t0;
      const ink = css("--text");
      const muted = css("--muted");
      const hue = css("--hue");
      const rule = css("--control");
      const faint = css("--grey-mark");
      const font = css("--display") || "sans-serif";
      ctx.clearRect(0, 0, W, H);
      layers.forEach((L, i) => {
        const y = shelfY(i);
        const last = i === layers.length - 1;
        ctx.strokeStyle = last ? hue : rule;
        ctx.lineWidth = last ? 2 : 1;
        ctx.setLineDash(last ? [] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(left(), y);
        ctx.lineTo(right(), y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = "right";
        ctx.fillStyle = last ? hue : ink;
        ctx.font = `600 ${W < 520 ? 17 : 22}px ${font}`;
        ctx.fillText(String(L.n), left() - 10, y + 1);
        if (W >= 520) {
          ctx.textAlign = "left";
          ctx.fillStyle = muted;
          ctx.font = `14px ${font}`;
          ctx.fillText(L.label, right() + 14, y + 1);
        } else {
          ctx.textAlign = "left";
          ctx.fillStyle = muted;
          ctx.font = `12px ${font}`;
          ctx.fillText(L.label, left(), y - 30 + (i === 0 ? 8 : 0));
        }
      });
      let moving = false;
      for (const g of grains) {
        if (g.y < g.ty) {
          if (t > g.delay) {
            g.vy = Math.min(g.vy + 0.45, 9);
            g.y = Math.min(g.ty, g.y + g.vy);
          }
          moving = true;
        }
        if (g.y < -10) continue;
        const last = g.layer === layers.length - 1;
        ctx.fillStyle = last ? hue : g.layer === 0 ? faint : ink;
        ctx.beginPath();
        ctx.arc(g.x, g.y, last ? 7 : g.layer === 0 ? 2.4 : 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (moving) raf = requestAnimationFrame(draw(t0));
    };

    build();
    raf = requestAnimationFrame((now) => draw(now)(now));
    // Re-lay the settled heap when the width changes; the first callback (same width) is ignored.
    const ro = new ResizeObserver(() => {
      if (box.clientWidth === W) return;
      cancelAnimationFrame(raf);
      build();
      grains.forEach((g) => (g.y = g.ty));
      raf = requestAnimationFrame((now) => draw(now)(now));
    });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [run, layers.map((l) => l.n).join(",")]);

  return (
    <figure className="sieve" aria-label={layers.map((l) => `${l.label}: ${l.n}`).join(", ")}>
      <div ref={wrap} className="sieve-canvas">
        <canvas ref={ref} role="img" aria-hidden />
      </div>
      <figcaption>
        <span>
          Each grain is a record that went no further; the green ones are still standing.
          {scale > 1 && ` On the top shelf one grain stands for ${scale} sources.`}
        </span>
        <button className="link-chip" onClick={() => setRun((r) => r + 1)}>
          Replay
        </button>
      </figcaption>
    </figure>
  );
}
