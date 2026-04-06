"use client";

import { useFlowStore } from "../../store/flow/flowStore";

type NodeNameInputProps = {
  nodeId: string;
  name: string;
  onNameChange: (value: string) => void;
  label?: string;
};

export default function NodeNameInput({
  nodeId,
  name,
  onNameChange,
  label = "Name",
}: NodeNameInputProps) {
  // Subscribe to nodes array to ensure re-render when nodes are deleted/added
  const nodes = useFlowStore((s) => s.nodes);
  const isNameTaken = useFlowStore((s) => s.isNameTaken);
  const isCollision = isNameTaken(name, nodeId);

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </label>
        {isCollision && (
          <span className="text-[10px] font-bold text-red-500 animate-pulse">
            Name already taken
          </span>
        )}
      </div>
      <input
        className={`mt-2 w-full rounded-xl border p-3 transition-all duration-200 outline-none placeholder:text-gray-400 ${
          isCollision
            ? "border-red-300 bg-red-50 text-red-900 focus:ring-4 focus:ring-red-500/10"
            : "border-gray-200 bg-white text-gray-900 hover:border-cyan-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
        }`}
        value={name}
        placeholder="Enter unique name..."
        onChange={(e) => onNameChange(e.target.value)}
      />
      {isCollision && (
        <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-[9px] text-red-400 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Node names must be unique for correct routing
        </div>
      )}
    </div>
  );
}
