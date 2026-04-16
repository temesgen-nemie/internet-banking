import { NodeProps, Handle, Position } from "reactflow";
import { useFlowStore } from "../../store/flow/flowStore";
import { useShallow } from "zustand/react/shallow";

export default function GroupNode({ id, data, selected }: NodeProps) {
  const { enterSubflow, refreshFlow, isLoading, publishedGroupIds, modifiedGroupIds, openRefreshConfirm } = useFlowStore();
  
  // Get children count from store
  const { childrenCount, flowName, isRootServiceGroup } = useFlowStore(
    useShallow((s) => {
        const children = s.nodes.filter((n) => n.parentNode === id);
        const startNode = children.find(n => n.type === 'start');
        const currentNode = s.nodes.find((n) => n.id === id);
        const flowName = startNode ? (startNode.data.flowName as string) : null;
        return {
            childrenCount: children.length,
            flowName,
            isRootServiceGroup:
              !currentNode?.parentNode &&
              (String(currentNode?.id ?? "").startsWith("service-root-") ||
                startNode?.type === "start"),
        };
    })
  );

  const isMenuBranch = data.isMenuBranch === true;
  const isPublished = publishedGroupIds.includes(id);
  const isModified = modifiedGroupIds.includes(id);

  return (
    <div
      className={`relative group bg-white/95 backdrop-blur-sm border-2 rounded-2xl p-4 transition-all duration-300 min-w-[240px] shadow-lg ${
        selected
          ? isMenuBranch
            ? "border-emerald-500 ring-4 ring-emerald-500/20 scale-105"
            : "border-indigo-500 ring-4 ring-indigo-500/20 scale-105"
          : isMenuBranch
            ? "border-emerald-400 hover:border-emerald-500"
            : "border-indigo-200 hover:border-indigo-400 hover:shadow-xl"
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        enterSubflow(id);
      }}
    >
      {!isRootServiceGroup && (
        <Handle
          type="target"
          position={Position.Top}
          className={isMenuBranch ? "border-emerald-500" : "border-indigo-500"}
        />
      )}

      {/* Decorative Gradient Bar */}
      <div className={`absolute top-0 left-0 right-0 h-2 rounded-t-2xl opacity-80 ${
        isMenuBranch 
          ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" 
          : "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"
      }`} />

      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
             <div className={`p-2 rounded-lg ${isMenuBranch ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuBranch ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  )}
                </svg>
             </div>
             <div className="min-w-0">
                <h3 className="font-bold text-gray-800 tracking-tight truncate" title={data.name || "Untitled Group"}>
                  {data.name || "Untitled Group"}
                </h3>
                <p className={`text-[10px] uppercase font-bold tracking-widest ${isMenuBranch ? "text-emerald-400" : "text-indigo-400"}`}>
                  {isMenuBranch ? "Menu Branch Flow" : "Subflow Container"}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2">
            {isPublished ? (
              <div className="flex items-center gap-1.5">
                {isModified && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold animate-pulse shadow-sm">
                    <span className="w-1 h-1 rounded-full bg-rose-500" />
                    Changed
                  </span>
                )}
                <button
                  onClick={(e) => {
                      if (flowName) {
                          e.stopPropagation();
                          if (isModified) {
                              openRefreshConfirm("group", flowName, id);
                          } else {
                              refreshFlow(flowName, id);
                          }
                      }
                  }}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed group/refresh"
                  title={`Refresh flow '${flowName}' from backend`}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : 'group-hover/refresh:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                 Unpublished
              </span>
            )}
          </div>
        </div>

        {/* Content Preview */}
        <div className="py-2 px-3 bg-gray-50/50 rounded-xl border border-gray-100 flex items-center justify-between group-hover:bg-white transition-colors">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500">Internal Nodes</span>
            <span className={`text-lg font-black ${isMenuBranch ? "text-emerald-600" : "text-indigo-600"}`}>{childrenCount}</span>
          </div>
          
          <button 
             onClick={(e) => {
               e.stopPropagation();
               enterSubflow(id);
             }}
             className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-sm ${
               isMenuBranch 
                 ? "bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white" 
                 : "bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white"
             }`}
          >
             <span>Enter</span>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
             </svg>
          </button>
        </div>

        <div className="text-[9px] text-gray-400 italic text-center">
            Double-click to drill down
        </div>
      </div>
    </div>
  );
}
