import { Handle, Position, NodeProps } from "reactflow";
import { Badge } from "@/components/ui/badge";
import type { ActionNodeData } from "../inspector/action/types";
import { useFlowStore } from "@/store/flow/flowStore";

type ActionNodeProps = NodeProps<ActionNodeData>;

export default function ActionNode({ id, data, selected }: ActionNodeProps) {
  const edges = useFlowStore((s) => s.edges);
  const sourceLabel =
    data.requestSource === "local"
      ? "local storage"
      : data.requestSource === "ws"
        ? "websocket"
        : "api";
  const sourceBadgeClass =
    data.requestSource === "local"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : data.requestSource === "ws"
        ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  const sourceHint =
    data.requestSource === "ws" ? data.wsUrl || "no websocket URL" : data.endpoint || "no endpoint";

  const formatCondition = (condition?: string) => {
    if (!condition) return "True";
    try {
      const parsed = JSON.parse(condition) as Record<string, unknown>;
      const operator = Object.keys(parsed)[0];
      const operands = parsed[operator] as unknown[];
      const left = String(operands?.[0] ?? "");
      const right = operands?.[1];
      const path = left.startsWith("{{response.")
        ? left.replace("{{response.", "").replace("}}", "")
        : left;

      const operatorLabel =
        operator === "eq"
          ? "="
          : operator === "ne"
            ? "≠"
            : operator === "contains"
              ? "∋"
              : operator;

      return `${path} ${operatorLabel} ${String(right ?? "")}`.trim();
    } catch {
      return "Condition";
    }
  };

  return (
    <div
      className={`rounded-2xl p-4 w-72 bg-slate-900 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-2 transition-all duration-200
      ${
        selected
          ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] scale-[1.02]"
          : "border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <div className="font-black text-emerald-400 text-sm tracking-tight">
            {data.name || "API ACTION"}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
            {sourceHint}
          </div>
        </div>
        <Badge
          variant="secondary"
          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border h-fit ${sourceBadgeClass}`}
        >
          {sourceLabel}
        </Badge>
      </div>

      {/* Dynamic Handles for Routes */}
      <div className="flex flex-col gap-1.5">
        {(data.routes || []).map((route, index) => {
          const isActuallyConnected = edges.some(
            (e) => e.source === id && e.sourceHandle === route.id
          );
          return (
            <div
              key={route.id || index}
              className={`group relative flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 border rounded-lg px-2.5 py-1.5 transition-colors ${
                isActuallyConnected ? "border-slate-700/50" : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isActuallyConnected ? "bg-emerald-500/50" : "bg-amber-500/80 animate-pulse"
                  }`}
                />
                <div
                  className={`text-[11px] font-bold truncate ${
                    isActuallyConnected ? "text-slate-200" : "text-amber-200/90"
                  }`}
                  title={formatCondition(route.condition)}
                >
                  {formatCondition(route.condition)}
                </div>
              </div>

              <Handle
                type="source"
                position={Position.Right}
                id={route.id}
                className={`!w-3 !h-3 !-right-1.5 !bg-slate-900 !border-2 !top-1/2 !-translate-y-1/2 ${
                  isActuallyConnected ? "!border-emerald-500" : "!border-amber-500"
                }`}
              />
            </div>
          );
        })}

        {(!data.routes || data.routes.length === 0) && (
          <div className="text-center py-2 text-[10px] text-slate-600 italic border border-dashed border-slate-800 rounded-lg">
            No routes defined
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-900 !border-2 !border-emerald-500"
      />

      {/* Default/Fallback Exit */}
      {(() => {
        const isActuallyConnected = edges.some(
          (e) => e.source === id && e.sourceHandle === "default"
        );
        return (
          <div className="mt-1 pt-1 border-t border-slate-800 flex flex-col items-center gap-0.5">
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isActuallyConnected ? "text-slate-500" : "text-slate-600"
              }`}
            >
              Default flow
            </div>
            <Handle
              type="source"
              position={Position.Bottom}
              id="default"
              className={`!w-3 !h-3 !bg-slate-900 !border-2 !-bottom-1.5 !static !translate-x-0 ${
                isActuallyConnected ? "!border-slate-500" : "!border-slate-700"
              }`}
            />
          </div>
        );
      })()}
    </div>
  );
}
