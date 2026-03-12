"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { useFlowStore } from "../../store/flow/flowStore";
import { buildFlowJson } from "../../store/flow/serialization";

export default function NodeJsonModal() {
  const { nodeJsonModal, closeNodeJson, nodes, edges } = useFlowStore();
  const isOpen = Boolean(nodeJsonModal?.isOpen);

  const { title, jsonText } = useMemo(() => {
    if (!isOpen || !nodeJsonModal?.nodeId) {
      return { title: "Node JSON", jsonText: "" };
    }

    const node = nodes.find((n) => n.id === nodeJsonModal.nodeId);
    const flowJson = buildFlowJson(nodes, edges);

    if (!node) {
      return { title: "Node JSON", jsonText: "{}" };
    }

    if (node.type === "start") {
      const payload = {
        id: node.id,
        type: "start",
        flowName: flowJson.flowName,
        entryNode: flowJson.entryNode,
        entryNodeId: flowJson.entryNodeId,
      };
      return {
        title: "Start Node JSON",
        jsonText: JSON.stringify(payload, null, 2),
      };
    }

    const logicalNode = flowJson.nodes.find((n) => n.id === node.id);
    if (logicalNode) {
      return {
        title: `${logicalNode.name || logicalNode.type} JSON`,
        jsonText: JSON.stringify(logicalNode, null, 2),
      };
    }

    const fallback = {
      id: node.id,
      type: node.type,
      data: node.data,
      position: node.position,
      parentNode: node.parentNode,
    };
    return {
      title: `${node.type} JSON`,
      jsonText: JSON.stringify(fallback, null, 2),
    };
  }, [edges, isOpen, nodeJsonModal?.nodeId, nodes]);

  if (!isOpen || !nodeJsonModal) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-indigo-950/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={closeNodeJson}
      />
      <div className="relative w-[90vw] max-w-3xl max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-indigo-100 flex flex-col overflow-hidden transform animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-8 py-5 border-b border-indigo-50 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-black text-gray-800 tracking-tight">Node JSON</div>
              <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                {title}
              </div>
            </div>
          </div>
          <button
            className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-indigo-600 transition-all active:scale-95"
            onClick={closeNodeJson}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 p-8 overflow-auto bg-gray-50/50 font-mono text-sm leading-relaxed">
          <div className="bg-white rounded-2xl border border-indigo-50 shadow-inner p-6">
            <textarea
              readOnly
              value={jsonText}
              spellCheck={false}
              className="w-full min-h-[35vh] text-gray-500 whitespace-pre-wrap bg-transparent outline-none resize-none cursor-default"
            />
          </div>
        </div>

        <div className="px-8 py-4 bg-indigo-50/30 border-t border-indigo-50 flex justify-end gap-3">
          <button
            onClick={closeNodeJson}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(jsonText);
              toast.success("Copied to clipboard");
            }}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy JSON
          </button>
        </div>
      </div>
    </div>
  );
}
