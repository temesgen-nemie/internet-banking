import React from "react";
import { useFlowStore } from "../../store/flow/flowStore";

const RefreshConfirmModal: React.FC = () => {
  const { 
    refreshConfirmModal, 
    closeRefreshConfirm, 
    loadAllFlows, 
    refreshFlow,
    isLoading,
    nodes,
    modifiedGroupsLog,
    publishedGroupIds
  } = useFlowStore();

  if (!refreshConfirmModal.isOpen) return null;

  const { type, flowName, groupId } = refreshConfirmModal;

  const handleConfirm = async () => {
    if (type === "global") {
      await loadAllFlows();
    } else if (type === "group" && flowName && groupId) {
      await refreshFlow(flowName, groupId);
    }
    closeRefreshConfirm();
  };

  const isGlobal = type === "global";

  // Filter and prepare display data
  const affectedGroups = isGlobal 
    ? publishedGroupIds.filter(id => (modifiedGroupsLog[id] || []).length > 0)
    : (groupId ? [groupId] : []);

  const getGroupName = (id: string) => {
    const node = nodes.find(n => n.id === id);
    return node?.data?.name || node?.data?.flowName || "Unknown Flow";
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={!isLoading ? closeRefreshConfirm : undefined}
    >
      <div 
        className="w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-[110] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-amber-100 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 tracking-tight">Refreshing Data...</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">Please wait a moment</p>
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {isGlobal ? "Refresh All Flows" : "Refresh Flow"}
              </h3>
              <p className="text-sm text-slate-500 font-medium">Unsaved changes detected</p>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <p className="text-slate-600 leading-relaxed">
              {isGlobal ? (
                <>Refreshing all flows will <span className="font-bold text-slate-900">discard all local changes</span> made across the following flows:</>
              ) : (
                <>Refreshing <span className="font-bold text-slate-900">"{flowName}"</span> will discard the following local changes:</>
              )}
            </p>

            {/* Change Log List */}
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {affectedGroups.map(id => (
                <div key={id} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{getGroupName(id)}</span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {(modifiedGroupsLog[id] || []).length} Changes
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    {(modifiedGroupsLog[id] || []).map((change, idx) => {
                      const isUpdate = change.includes(" → ");
                      let header = change;
                      let from = "";
                      let to = "";

                      if (isUpdate) {
                        const parts = change.split(": ");
                        header = parts[0];
                        const values = parts[1]?.split(" → ");
                        from = values?.[0] || "";
                        to = values?.[1] || "";
                      }

                      return (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed group">
                          <div className="mt-1.5 w-1 h-1 bg-amber-400 rounded-full flex-shrink-0 group-hover:scale-150 transition-transform" />
                          {isUpdate ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-800">{header}</span>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-slate-200/50 px-1.5 py-0.5 rounded text-[10px] text-slate-500 line-through decoration-slate-400/50">
                                  {from.replace(/"/g, '')}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="bg-amber-100/50 px-1.5 py-0.5 rounded text-[10px] text-amber-700 font-bold border border-amber-200/30">
                                  {to.replace(/"/g, '')}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-medium">{change}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200/50 flex flex-col gap-3">
              <p className="text-xs text-amber-700 font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Warning: Work will be lost!
              </p>
              <p className="text-[11px] text-amber-800/80 leading-relaxed">
                If you want to keep these changes, please <span className="font-bold underline">Cancel and click "Update Flow"</span> in the Group node before refreshing. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={closeRefreshConfirm}
              disabled={isLoading}
              className="flex-1 px-6 py-3.5 rounded-2xl text-slate-600 font-semibold hover:bg-slate-100 active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 px-6 py-3.5 rounded-2xl bg-amber-600 text-white font-semibold shadow-lg shadow-amber-200 hover:bg-amber-700 active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              Confirm Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefreshConfirmModal;
