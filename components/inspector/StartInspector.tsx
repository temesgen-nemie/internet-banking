"use client";

type StartInspectorProps = {
  node: StartNode;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

type StartNodeData = {
  flowName?: string;
  entryNode?: string;
  entryNodeId?: string;
};

type StartNode = {
  id: string;
  data: StartNodeData;
};

import TargetNodeDisplay from "./TargetNodeDisplay";

export default function StartInspector({
  node,
  updateNodeData,
}: StartInspectorProps) {
  return (
    <div>
      <div className="mb-6">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Flow Name</label>
        <input
          className="mt-2 w-full rounded-xl border border-gray-100 p-3 bg-white shadow-sm placeholder-gray-400 text-gray-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
          value={String(node.data.flowName ?? "")}
          placeholder="e.g. My USSD Flow"
          onChange={(e) => updateNodeData(node.id, { flowName: e.target.value })}
        />
      </div>

      <TargetNodeDisplay
        nodeId={node.data.entryNodeId || ""}
        label="Entry Node"
        title="Connect the Start Node to the first node of your flow"
      />
    </div>
  );
}
