type Color = "green" | "red" | "yellow" | "blue" | "purple" | "orange" | "muted";

const colorMap: Record<Color, string> = {
  green:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  red:    "bg-red-500/15 text-red-400 border-red-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blue:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  muted:  "bg-slate-700/40 text-slate-400 border-slate-600/30",
};

export function Badge({ label, color = "muted", size = "sm" }: { label: string; color?: Color; size?: "xs" | "sm" }) {
  const sz = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center font-semibold tracking-wide uppercase border rounded ${sz} ${colorMap[color]}`}>
      {label}
    </span>
  );
}
