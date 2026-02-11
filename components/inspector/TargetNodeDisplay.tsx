"use client";

import { useMemo } from "react";
import { useFlowStore } from "../../store/flow/flowStore";

type TargetNodeRef =
  | string
  | {
      defaultId?: string;
      default?: string;
      gotoId?: string;
      gotoFlow?: string;
      goto?: string;
    }
  | null
  | undefined;

type TargetNodeDisplayProps = {
  nodeId: TargetNodeRef;
  label: string;
  placeholder?: string;
  title?: string;
  className?: string;
};

export default function TargetNodeDisplay({ 
  nodeId, 
  label, 
  placeholder = "Connect nodes on canvas", 
  title,
  className = "" 
}: TargetNodeDisplayProps) {
  const safeNodeId = (id: TargetNodeRef): string => {
    if (!id) return "";
    if (typeof id === "string") {
      if (id === "[object Object]" || id === "undefined" || id === "null") return "";
      return id;
    }
    if (typeof id === "object") {
      return (id.defaultId || id.default || id.gotoId || id.gotoFlow || id.goto || "") as string;
    }
    return "";
  };

  const rawIdValue = safeNodeId(nodeId);
  const resolveTargetId = useFlowStore((s) => s.resolveTargetId);
  const nodes = useFlowStore((s) => s.nodes);

  const resolved = useMemo(() => resolveTargetId(rawIdValue), [resolveTargetId, rawIdValue, nodes]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === resolved.id), [nodes, resolved.id]);

  // Always show the technical ID in the left box
  const displayId = resolved.id || rawIdValue;
  const targetName = resolved.name || targetNode?.data?.name;
  const isGroup = targetNode?.type === "group";

  return (
    <div className={className}>
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <div className="flex items-center gap-1.5 group">
        <div className="flex-1 relative">
           <input
             className={`w-full rounded-lg border border-gray-100 p-1.5 bg-gray-50/50 shadow-sm text-gray-500 cursor-not-allowed text-[10px] font-mono transition-all group-hover:bg-gray-50 ${displayId ? 'pr-6' : ''}`}
             value={displayId}
             placeholder={placeholder}
             readOnly
             title={title}
           />
           {displayId && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 font-bold uppercase">
                ID
              </div>
           )}
        </div>
        
        {displayId && (
          <div className="flex-[1.2] animate-in slide-in-from-left-2 fade-in duration-300 min-w-0">
             <div className={`w-full rounded-lg border p-1.5 shadow-sm flex items-center gap-1.5 ${
               isGroup 
                 ? "bg-purple-50 border-purple-100 text-purple-700" 
                 : "bg-indigo-50 border-indigo-100 text-indigo-700"
             }`}>
               <div className={`p-1 rounded-md ${isGroup ? 'bg-purple-600' : 'bg-indigo-600'} text-white flex-shrink-0`}>
                 {isGroup ? (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                   </svg>
                 ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                   </svg>
                 )}
               </div>
               <span className="text-[11px] font-bold truncate">
                 {targetName || "Unnamed Node"}
               </span>
               {isGroup && (
                 <span className="text-[8px] font-bold bg-white/50 px-1 py-0.5 rounded-full uppercase leading-none">Group</span>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
