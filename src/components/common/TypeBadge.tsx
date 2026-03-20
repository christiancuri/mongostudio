import { cn } from "@/lib/utils";

interface TypeBadgeProps {
  type: string;
}

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ObjectId: { bg: "bg-gray-500/20", text: "text-gray-400" },
  String: { bg: "bg-green-500/20", text: "text-green-400" },
  Number: { bg: "bg-blue-500/20", text: "text-blue-400" },
  Boolean: { bg: "bg-red-500/20", text: "text-red-400" },
  Date: { bg: "bg-purple-500/20", text: "text-purple-400" },
  Null: { bg: "bg-gray-500/10", text: "text-muted-foreground/50" },
  Undefined: { bg: "bg-gray-500/10", text: "text-muted-foreground/50" },
  Array: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  Object: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  Long: { bg: "bg-blue-500/20", text: "text-blue-400" },
  Decimal: { bg: "bg-blue-500/20", text: "text-blue-400" },
  Binary: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  Regex: { bg: "bg-orange-500/20", text: "text-orange-400" },
  Timestamp: { bg: "bg-purple-500/20", text: "text-purple-400" },
};

export function TypeBadge({ type }: TypeBadgeProps) {
  const style = TYPE_STYLES[type] ?? {
    bg: "bg-gray-500/20",
    text: "text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-tight",
        style.bg,
        style.text,
      )}
    >
      {type}
    </span>
  );
}
