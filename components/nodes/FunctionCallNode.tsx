import { Handle, NodeProps, Position } from "reactflow";
import { useFlowStore } from "@/store/flow/flowStore";

type FunctionCallNodeData = {
  name?: string;
  functionName?: string;
  args?: Record<string, unknown>;
  saveAs?: string;
};

type FunctionCallNodeProps = NodeProps<FunctionCallNodeData>;

const summarizeArgs = (args?: Record<string, unknown>) => {
  if (!args || typeof args !== "object") return "No args";
  const keys = Object.keys(args);
  if (keys.length === 0) return "No args";
  if (keys.length <= 2) return `args: ${keys.join(", ")}`;
  return `args: ${keys.slice(0, 2).join(", ")} +${keys.length - 2} more`;
};

export default function FunctionCallNode({ id, data, selected }: FunctionCallNodeProps) {
  const edges = useFlowStore((s) => s.edges);
  const isConnected = edges.some((e) => e.source === id && e.sourceHandle === "default");

  return (
    <div
      className={`w-72 rounded-2xl border-2 bg-slate-900 p-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200 ${
        selected
          ? "border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.2)] scale-[1.02]"
          : "border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-black tracking-tight text-teal-300">
            {data.name || "FUNCTION CALL"}
          </div>
          <div className="text-[10px] font-medium text-slate-500">
            {data.functionName || "No function set"}
          </div>
        </div>
        <span className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-teal-300">
          function
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-[10px] text-slate-400">
        {summarizeArgs(data.args)}
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        saveAs: <span className="text-slate-300">{data.saveAs || "not set"}</span>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="h-3! w-3! border-2! border-teal-400! bg-slate-900!"
      />

      <div className="mt-3 flex flex-col items-center gap-0.5 border-t border-slate-800 pt-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
        Next
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className={`!h-3 !w-3 !static !translate-x-0 !bg-slate-900 !border-2 ${
            isConnected ? "!border-teal-400" : "!border-slate-700"
          }`}
        />
      </div>
    </div>
  );
}
