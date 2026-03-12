"use client";

import { useMemo, useState } from "react";
import NodeNameInput from "./NodeNameInput";
import TargetNodeDisplay from "./TargetNodeDisplay";

type FunctionCallNodeData = {
  name?: string;
  functionName?: string;
  args?: Record<string, unknown>;
  saveAs?: string;
  nextNode?: string;
};

type FunctionCallNode = {
  id: string;
  parentNode?: string;
  data: FunctionCallNodeData;
};

type FunctionCallInspectorProps = {
  node: FunctionCallNode;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

const formatArgs = (args?: Record<string, unknown>) => {
  if (!args || typeof args !== "object") return "{}";
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return "{}";
  }
};

export default function FunctionCallInspector({
  node,
  updateNodeData,
}: FunctionCallInspectorProps) {
  const [argsText, setArgsText] = useState(() => formatArgs(node.data.args));
  const [argsError, setArgsError] = useState<string | null>(null);

  const argsHint = useMemo(() => {
    const trimmed = argsText.trim();
    if (!trimmed || trimmed === "{}") return "No args set";
    return "JSON object";
  }, [argsText]);

  const handleArgsChange = (value: string) => {
    setArgsText(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setArgsError(null);
      updateNodeData(node.id, { args: {} });
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setArgsError(null);
        updateNodeData(node.id, { args: parsed });
        return;
      }
      setArgsError("Args must be a JSON object.");
    } catch (error) {
      setArgsError(error instanceof Error ? error.message : "Invalid JSON.");
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <NodeNameInput
          nodeId={node.id}
          name={String(node.data.name ?? "")}
          onNameChange={(val) => updateNodeData(node.id, { name: val })}
        />

        <div>
          <label className="text-xs font-medium text-gray-600">Function Name</label>
          <input
            className="mt-2 w-full rounded-md border border-gray-100 p-2 bg-white shadow-sm placeholder-gray-400 text-gray-900"
            value={String(node.data.functionName ?? "")}
            onChange={(e) => updateNodeData(node.id, { functionName: e.target.value })}
            placeholder="getCustomerTier"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Save Result As</label>
          <input
            className="mt-2 w-full rounded-md border border-gray-100 p-2 bg-white shadow-sm placeholder-gray-400 text-gray-900"
            value={String(node.data.saveAs ?? "")}
            onChange={(e) => updateNodeData(node.id, { saveAs: e.target.value })}
            placeholder="customerTierResult"
          />
        </div>

        <TargetNodeDisplay
          nodeId={node.data.nextNode as string}
          label="Next Node"
          title="Connect the Function Call node bottom handle on the canvas"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Args (JSON)</label>
          <textarea
            className={`mt-2 w-full rounded-md border p-2 font-mono text-xs shadow-sm ${
              argsError ? "border-red-200 bg-red-50 text-red-700" : "border-gray-100 bg-white text-gray-900"
            }`}
            rows={12}
            value={argsText}
            onChange={(e) => handleArgsChange(e.target.value)}
            placeholder='{"msisdn": "{{vars.msisdn}}", "accountId": "{{vars.accountId}}"}'
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
            <span>{argsHint}</span>
            {argsError && <span className="text-red-500">{argsError}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
