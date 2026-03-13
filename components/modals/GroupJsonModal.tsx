"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useFlowStore, type FlowJson } from "../../store/flow/flowStore";

export default function GroupJsonModal() {
  const { groupJsonModal, closeGroupJson, nodes, getRecursiveSubflowJson } = useFlowStore();
  const [isDeep, setIsDeep] = useState(false);

  const isOpen = Boolean(groupJsonModal?.isOpen);

  const draftJson = useMemo(() => {
    if (!isOpen || !groupJsonModal?.groupId) return "";
    return isDeep
      ? getRecursiveSubflowJson(groupJsonModal.groupId)
      : groupJsonModal.json;
  }, [isOpen, groupJsonModal, isDeep, getRecursiveSubflowJson]);

  if (!isOpen || !groupJsonModal) return null;

  const groupNode = nodes.find((n) => n.id === groupJsonModal.groupId);
  const groupName = groupNode?.data.name || "Subflow";

  const downloadJson = () => {
    // ALWAYS export recursive JSON for the file, even if view is currently shallow
    const recursiveJson = groupJsonModal.groupId 
      ? getRecursiveSubflowJson(groupJsonModal.groupId) 
      : draftJson;

    const blob = new Blob([recursiveJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${groupName.replace(/\s+/g, "_").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Recursive JSON file exported.");
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-indigo-950/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={closeGroupJson}
      />
      <div className="relative w-[90vw] max-w-4xl max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-indigo-100 flex flex-col overflow-hidden transform animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-8 py-5 border-b border-indigo-50 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-black text-gray-800 tracking-tight">Subflow JSON Export</div>
              <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{groupName}</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isDeep}
                  onChange={(e) => setIsDeep(e.target.checked)}
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${isDeep ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${isDeep ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-[10px] font-black text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Recursive Mode</span>
            </label>
            <button
              className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-indigo-600 transition-all active:scale-95"
              onClick={closeGroupJson}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto bg-gray-50/50 font-mono text-sm leading-relaxed">
          <div className="bg-white rounded-2xl border border-indigo-50 shadow-inner p-6">
            <textarea
              readOnly
              value={draftJson}
              spellCheck={false}
              className="w-full min-h-[40vh] text-gray-500 whitespace-pre-wrap bg-transparent outline-none resize-none cursor-default"
            />
          </div>
        </div>

        <div className="px-8 py-4 bg-indigo-50/30 border-t border-indigo-50 flex justify-end gap-3">
          <button
            onClick={closeGroupJson}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={downloadJson}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export JSON File
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(draftJson);
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
