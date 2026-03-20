import { cn } from "@/lib/utils";

interface ConnectionBadgeProps {
  color: string;
  name: string;
  className?: string;
}

export function ConnectionBadge({ color, name, className }: ConnectionBadgeProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: getColorHex(color) }}
      />
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    gray: "#6b7280",
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };
  return colors[color] ?? colors.gray;
}
