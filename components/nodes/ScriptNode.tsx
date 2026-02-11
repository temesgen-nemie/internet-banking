import { Handle, Position, NodeProps } from "reactflow";
import { useFlowStore } from "@/store/flow/flowStore";

type ScriptNodeData = {
  name?: string;
  script?: string;
  timeoutMs?: number;
  routes?: { id: string; key?: string; nextNodeId?: string }[];
};

type ScriptNodeProps = NodeProps<ScriptNodeData>;

export default function ScriptNode({ id, data, selected }: ScriptNodeProps) {
  const edges = useFlowStore((s) => s.edges);

  return (
    <div
      className={`w-72 rounded-2xl border-2 bg-slate-900 p-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200 ${
        selected
          ? "border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] scale-[1.02]"
          : "border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-black tracking-tight text-cyan-300">
            {data.name || "SCRIPT"}
          </div>
          <div className="text-[10px] font-medium text-slate-500">
            timeout: {data.timeoutMs ?? 25}ms
          </div>
        </div>
        <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300">
          script
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-[10px] text-slate-400">
        {data.script ? data.script.split("\n")[0] : "No script yet"}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="h-3! w-3! border-2! border-cyan-400! bg-slate-900!"
      />

      <div className="mt-3 flex flex-col gap-1.5">
        {(data.routes || []).map((route, index) => {
          const isConnected = edges.some(
            (e) => e.source === id && e.sourceHandle === route.id
          );
          return (
            <div
              key={route.id || index}
              className={`relative flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${
                isConnected
                  ? "border-slate-700 bg-slate-800/50 text-slate-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              <span className="truncate">
                {route.key?.trim() ? route.key : "Route"}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={route.id}
                className={`!h-3 !w-3 !-right-1.5 !top-1/2 !-translate-y-1/2 !bg-slate-900 !border-2 ${
                  isConnected ? "!border-cyan-400" : "!border-amber-500"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col items-center gap-0.5 border-t border-slate-800 pt-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
        Default
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className="!h-3 !w-3 !static !translate-x-0 !bg-slate-900 !border-2 !border-cyan-400"
        />
      </div>
    </div>
  );
}
