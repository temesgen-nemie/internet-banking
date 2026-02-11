
import { Handle, Position, NodeProps } from "reactflow";
import { useFlowStore } from "@/store/flow/flowStore";

type ConditionRoute = {
  when?: Record<string, [string, string | number]>;
  goto?: string;
};

type ConditionNextNode = {
  routes?: ConditionRoute[];
  default?: string;
};

type ConditionNodeData = {
  name?: string;
  nextNode?: ConditionNextNode;
};

type ConditionNodeProps = NodeProps<ConditionNodeData>;

export default function ConditionNode({ id, data, selected }: ConditionNodeProps) {
  const edges = useFlowStore((s) => s.edges);
  const resolveTargetId = useFlowStore((s) => s.resolveTargetId);

  return (
    <div
      className={`group rounded-xl p-0 w-64 bg-white shadow-xl border-2 transition-all duration-200 overflow-hidden
      ${
        selected
          ? "border-pink-500 ring-4 ring-pink-100 scale-[1.02]"
          : "border-gray-100 hover:border-pink-200"
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-tr from-pink-500 to-rose-500 p-3 flex items-center justify-between">
        <div className="font-bold text-white truncate max-w-[180px] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/><path d="M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/><path d="M18 19a3 3 0 1 1-2.14-5.18"/>
            </svg>
           {data.name || "Condition"}
        </div>
      </div>

      {/* Routes & Logic */}
      <div className="p-3 bg-white space-y-2">
          {data.nextNode &&
            data.nextNode.routes &&
            data.nextNode.routes.map((route, idx: number) => {
              // Extract logic for display
              // e.g. { gt: ["{{vars.amount}}", 1000] }
              const operator = route.when ? Object.keys(route.when)[0] : "else";
              const val = route.when ? route.when[operator]?.[1] : "";
              const variable = route.when ? route.when[operator]?.[0] : "";
              
              // Friendly operator map
              const opMap: Record<string, string> = {
                  eq: "=",
                  gt: ">",
                  lt: "<",
                  gte: ">=",
                  lte: "<=",
                  neq: "!="
              };

              const displayOp = opMap[operator] || operator;
              const displayVar = String(variable).replace(/{{vars\.(.*?)}}/, "$1");

              const handleId = `route-${idx}`;
              const isActuallyConnected = edges.some(e => e.source === id && e.sourceHandle === handleId);

              return (
                <div
                  key={idx}
                  className={`relative flex items-center justify-between text-xs p-2 rounded-lg border transition-colors group/item ${
                    isActuallyConnected 
                      ? "bg-pink-50 border-pink-100" 
                      : "bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden w-full pr-4">
                     <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                        <span className="truncate max-w-[60px]" title={String(variable)}>{displayVar || "?"}</span>
                        <span className="font-bold text-pink-500">{displayOp}</span>
                        <span className="truncate max-w-[40px] font-bold text-gray-700">{val}</span>
                     </div>
                    <span
                      className={`font-semibold truncate max-w-[120px] ${
                         isActuallyConnected ? "text-gray-800" : "text-gray-400"
                      }`}
                      title={route.goto}
                    >
                      {(() => {
                        if (!isActuallyConnected || !route.goto) return route.goto || "Set Target";
                        // Find the actual edge to get the resolved target name
                        const edge = edges.find(e => e.source === id && e.sourceHandle === handleId);
                        if (!edge) return route.goto;
                        const resolved = resolveTargetId(edge.target);
                        return resolved.name || route.goto;
                      })()}
                    </span>
                  </div>
                  
                  {/* Source Handle */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    className={`!-right-3 !w-3 !h-3 !border-2 transition-all ${
                      isActuallyConnected 
                       ? "!border-pink-500 !bg-white" 
                       : "!border-gray-300 !bg-gray-50 group-hover/item:!border-pink-300"
                    }`}
                  />
                </div>
              );
            })}

            {/* Default Route */}
            <div className={`relative flex items-center justify-between text-xs p-2 rounded-lg border transition-colors group/item ${
                 edges.some(e => e.source === id && e.sourceHandle === 'default')
                   ? "bg-gray-100 border-gray-200" 
                   : "bg-white border-dashed border-gray-200"
                }`}>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Else (Default)</span>
                 <span className="text-gray-600 font-medium truncate max-w-[100px] ml-auto mr-2">
                    {(() => {
                      const fallback = data.nextNode?.default;
                      if (!fallback) return "Next";
                      const resolved = resolveTargetId(fallback);
                      return resolved.name || fallback;
                    })()}
                  </span>

                <Handle
                    type="source"
                    position={Position.Right}
                    id="default"
                    className={`!-right-3 !w-3 !h-3 !border-2 transition-all ${
                       edges.some(e => e.source === id && e.sourceHandle === 'default')
                       ? "!border-gray-500 !bg-white" 
                       : "!border-gray-300 !bg-gray-50 group-hover/item:!border-gray-400"
                    }`}
                  />
            </div>
      </div>

      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-white !border-2 !border-pink-500" />
    </div>
  );
}
