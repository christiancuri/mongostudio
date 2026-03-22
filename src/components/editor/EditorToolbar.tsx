import { Play, Bug, Square, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorToolbarProps {
  onRun?: () => void;
  onStop?: () => void;
  onExplain?: () => void;
  isExecuting?: boolean;
}

export function EditorToolbar({ onRun, onStop, onExplain, isExecuting }: EditorToolbarProps) {
  return (
    <div className="flex h-8 items-center gap-1 border-b border-border bg-background px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-xs text-green-500 hover:text-green-400"
            onClick={onRun}
            disabled={isExecuting}
          >
            <Play className="h-3 w-3" />
            Run
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Run Query (Ctrl+Enter)
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-xs"
            disabled={isExecuting}
          >
            <Bug className="h-3 w-3" />
            Debug
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Debug Query
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 ${isExecuting ? "text-red-500 hover:text-red-400" : ""}`}
            disabled={!isExecuting}
            onClick={onStop}
          >
            <Square className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Stop Execution
        </TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-xs"
            onClick={onExplain}
            disabled={isExecuting}
          >
            <FileSearch className="h-3 w-3" />
            Explain
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Explain Query
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
