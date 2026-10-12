/* eslint-disable @next/next/no-img-element -- remote cover images from many event hosts; plain img keeps it free and simple */
import type { Hue } from "@/lib/ui/colors";

/**
 * Event cover: the source's own image when it has one, otherwise a colour block in the
 * category's hue with soft shapes. Children are overlaid (chips, score).
 */
export function EventCover({ image, hue, seed, height = 170, children, rounded = "" }: { image: string | null; hue: Hue; seed: string; height?: number; children?: React.ReactNode; rounded?: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const cx = 60 + (h % 420);
  return (
    <div className={`relative overflow-hidden ${rounded}`} style={{ height, background: hue.tint }}>
      {image ? (
        <>
          <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
        </>
      ) : (
        <svg width="100%" height={height} viewBox={`0 0 600 ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0">
          <circle cx={cx} cy={height * 0.25} r={height * 0.72} fill={hue.shape} opacity="0.55" />
          <circle cx={(cx + 300) % 600} cy={height * 1.1} r={height * 0.55} fill={hue.shape} opacity="0.35" />
        </svg>
      )}
      {children}
    </div>
  );
}

export function Chip({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`rounded-full bg-white/90 px-3 py-1 text-[12.5px] text-ink backdrop-blur ${strong ? "font-semibold" : ""}`}>{children}</span>;
}
