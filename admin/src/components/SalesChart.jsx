import { useEffect, useRef, useState } from "react";
import { money, moneyCompact } from "../lib/format";

// Single-series column chart: revenue per day. One series => no legend; the title names it.
const BAR_COLOR = "#9B2C47"; // brand burgundy step that passes the palette checks (lightness, chroma, contrast)
const GRID = "#E7E5E4";
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

function niceStep(max, ticks = 4) {
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function columnPath(x, y, w, h, r) {
  // Rounded data-end (top), square at the baseline.
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export default function SalesChart({ data }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTable]); // the chart container remounts when switching back from the table view

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const orders = data.reduce((s, d) => s + d.orders, 0);
  const maxVal = Math.max(...data.map(d => d.revenue), 0);
  const step = maxVal > 0 ? niceStep(maxVal) : 250;
  const yMax = Math.max(step * Math.ceil(maxVal / step), step);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v) => PAD.top + plotH - (v / yMax) * plotH;
  const labelEvery = band < 34 ? 2 : 1;
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Revenue, last 14 days</h2>
          <p className="text-xs text-stone-500">{money(total)} from {orders} {orders === 1 ? "order" : "orders"} (excludes cancelled)</p>
        </div>
        <button onClick={() => setShowTable(t => !t)} className="text-xs text-stone-500 underline hover:text-burgundy">
          {showTable ? "Show chart" : "View as table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-stone-500 border-b border-stone-200"><th className="py-2 font-medium">Date</th><th className="py-2 font-medium text-right">Orders</th><th className="py-2 font-medium text-right">Revenue</th></tr></thead>
            <tbody>
              {[...data].reverse().map(d => (
                <tr key={d.date} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 text-stone-700">{dayLabel(d.date)}</td>
                  <td className="py-1.5 text-right tabular-nums text-stone-700">{d.orders}</td>
                  <td className="py-1.5 text-right tabular-nums text-stone-900">{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative" onMouseLeave={() => setHover(null)}>
          <svg width={width} height={HEIGHT} role="img" aria-label={`Revenue per day for the last 14 days, ${money(total)} in total`} className="block">
            {ticks.map(t => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#78716C">{moneyCompact(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const h = (d.revenue / yMax) * plotH;
              return (
                <g key={d.date}>
                  {hover === i && <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="#F5F5F4" />}
                  {d.revenue > 0 && (
                    <path d={columnPath(cx - barW / 2, y(d.revenue), barW, h, 4)} fill={BAR_COLOR} opacity={hover === null || hover === i ? 1 : 0.55} />
                  )}
                  {(i % labelEvery === (data.length - 1) % labelEvery) && (
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="#78716C">
                      {i === data.length - 1 ? "Today" : dayLabel(d.date)}
                    </text>
                  )}
                  {/* Hit target: the full band, much larger than the bar itself. */}
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH + 4} fill="transparent"
                    onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${dayLabel(d.date)}: ${money(d.revenue)}, ${d.orders} orders`} />
                </g>
              );
            })}
            <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#D6D3D1" strokeWidth="1" />
          </svg>

          {hovered && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-stone-900 text-white px-3 py-2 text-xs shadow-lg whitespace-nowrap"
              style={{ left: Math.min(Math.max(PAD.left + band * hover + band / 2, 70), width - 70), top: Math.max(y(hovered.revenue) - 8, 40) }}>
              <p className="font-semibold">{dayLabel(hovered.date)}</p>
              <p className="tabular-nums">{money(hovered.revenue)} · {hovered.orders} {hovered.orders === 1 ? "order" : "orders"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
