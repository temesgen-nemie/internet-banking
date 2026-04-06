"use client";

import React, { useEffect, type CSSProperties } from "react";
import { useFlowStore } from "../../store/flow/flowStore";
import { useAuthStore } from "../../store/authStore";
import { checkMyFlowPermission } from "../../lib/api";
import { toast } from "sonner";
import ActionInspector from "./ActionInspector";
import PromptInspector from "./PromptInspector";
import StartInspector from "./StartInspector";
import ConditionInspector from "./ConditionInspector";
import ScriptInspector from "./ScriptInspector";
import RouterInspector from "./RouterInspector";
import FunctionCallInspector from "./FunctionCallInspector";

export default function InspectorPanel() {
  const {
    nodes,
    selectedNodeId,
    updateNodeData,
    setNodes,
    closeInspector,
    syncNodeWithBackend,
    inspectorPosition,
  } = useFlowStore();
  const { user } = useAuthStore();

  const node = nodes.find((n) => n.id === selectedNodeId);

  // Track the original name to detect changes and send to backend
  const originalNameRef = React.useRef<string | undefined>(undefined);
  const originalDataRef = React.useRef<Record<string, unknown> | null>(null);
  const cloneData = (data: Record<string, unknown>) => {
    if (typeof structuredClone === "function") {
      return structuredClone(data);
    }
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  };

  useEffect(() => {
    if (selectedNodeId && node) {
      const currentName = String(node.data?.name || node.data?.flowName || "");
      if (originalNameRef.current === undefined && currentName) {
        originalNameRef.current = currentName;
      }
      if (!originalDataRef.current) {
        originalDataRef.current = cloneData((node.data ?? {}) as Record<string, unknown>);
      }
    }
  }, [selectedNodeId, node]);

  // Reset original name when inspector closes
  useEffect(() => {
    if (!selectedNodeId) {
      originalNameRef.current = undefined;
      originalDataRef.current = null;
    }
  }, [selectedNodeId]);

  // handle Escape locally as well for quick close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeInspector();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeInspector]);

  const [actionResetKey, setActionResetKey] = React.useState(0);

  // Drag and resize state
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState({ width: 0, height: 0 }); // 0 means use default
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Initialize size based on node type if not set
  useEffect(() => {
    if (size.width === 0 && node) {
      setSize({
        width:
          node.type === "action" ||
          node.type === "prompt" ||
          node.type === "condition" ||
          node.type === "router" ||
          node.type === "script"
          || node.type === "functionCall"
            ? 720
            : 350,
        height: 0, // allow auto height
      });
    }
  }, [node?.type]);

  const isScriptNameMissing =
    node?.type === "script" && !String(node?.data?.name ?? "").trim();

  const baseStyle: CSSProperties = inspectorPosition
    ? {
        position: "fixed",
        left: inspectorPosition.x + offset.x,
        top: inspectorPosition.y + offset.y,
        transform:
          inspectorPosition.placement === "above"
            ? "translate(-50%, -100%)"
            : inspectorPosition.placement === "below"
              ? "translate(-50%, 0)"
              : "translate(-50%, -50%)",
        zIndex: 100000,
        width: size.width > 0 ? size.width : undefined,
        height: size.height > 0 ? size.height : undefined,
        maxHeight: "90vh",
      }
    : {
        position: "fixed",
        left: `calc(50% + ${offset.x}px)`,
        top: `calc(50% + ${offset.y}px)`,
        transform: "translate(-50%, -50%)",
        zIndex: 100000,
        width: size.width > 0 ? size.width : undefined,
        height: size.height > 0 ? size.height : undefined,
        maxHeight: "90vh",
      };

  const handleReset = () => {
    if (!node) return;
    if (node.type === "prompt") {
      updateNodeData(node.id, {
        name: "",
        message: "",
        options: [],
        nextNode: { routes: [], default: "" }, // specific structure for prompt
      });
    } else if (node.type === "action") {
      updateNodeData(node.id, {
        name: "",
        requestSource: "api",
        endpoint: "",
        method: "POST",
        curl: "",
        wsCurl: "",
        wsUrl: "",
        wsProtocols: [],
        wsMessage: "",
        wsLastMessage: "",
        apiBody: {},
        headers: {},
        responseMapping: {},
        persistResponseMapping: false,
        fields: [""],
        outputVars: [""],
        field: "",
        outputVar: "",
        routes: [],
        nextNode: "",
      });
      setActionResetKey((value) => value + 1);
    } else if (node.type === "start") {
      updateNodeData(node.id, {
        flowName: "",
        entryNode: "",
      });
    } else if (node.type === "condition") {
      updateNodeData(node.id, {
        name: "",
        nextNode: { routes: [], default: "" },
      });
    } else if (node.type === "router") {
      updateNodeData(node.id, {
        name: "",
        url: "",
        method: "POST",
        sessionMode: "required",
        headers: {},
        apiBody: {},
        apiBodyRaw: "",
        bodyMode: "json",
        responseMapping: {},
        nextNode: { routes: [], default: "" },
      });
    } else if (node.type === "script") {
      updateNodeData(node.id, {
        name: "",
        script: "",
        timeoutMs: 25,
        nextNode: "",
        routes: [],
      });
    } else if (node.type === "functionCall") {
      updateNodeData(node.id, {
        name: "",
        functionName: "",
        args: {},
        saveAs: "",
        nextNode: "",
      });
    }
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from header
    if ((e.target as HTMLElement).closest("button")) return;

    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    setIsDragging(true);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (panelRef.current) {
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: panelRef.current.offsetWidth,
        height: panelRef.current.offsetHeight,
      });
      setIsResizing(true);
    }
  };

  // Global mouse handlers for drag/resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        setSize({
          width: Math.max(300, resizeStart.width + deltaX),
          height: Math.max(200, resizeStart.height + deltaY),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart]);

  if (!node) {
    return (
      <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-80 rounded-lg bg-white p-4 shadow-2xl text-center">
          <div className="text-gray-600">No node selected</div>
          <div className="text-sm text-gray-400">Double-click a node to open the inspector</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none" onClick={(e) => e.stopPropagation()}>
      <div
        ref={panelRef}
        style={baseStyle}
        className="pointer-events-auto rounded-xl bg-white shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden transition-none"
      >
        {/* Header - Draggable */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-start justify-between gap-3 p-4 pb-2 cursor-grab active:cursor-grabbing border-b border-gray-100 bg-gray-50/50"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-linear-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shrink-0">
              {/* simple icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2H2V5z" />
                <path d="M2 9h16v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800 capitalize">{node.type} Node</div>
              <div className="text-xs text-gray-500">Edit this nodes properties</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="px-2 py-1 rounded-md text-sm text-gray-500 hover:bg-gray-100"
              onClick={handleReset}
            >
              Reset
            </button>
            <button
              className="px-2 py-1 rounded-md text-sm bg-white text-gray-600 hover:bg-gray-100"
              onClick={() => closeInspector()}
              aria-label="Close inspector"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 pt-2 overflow-y-auto flex-1">
          <div className="space-y-3">
            {node.type === "prompt" && (
              <PromptInspector node={node} updateNodeData={updateNodeData} />
            )}

            {node.type === "action" && (
              <ActionInspector
                key={`action-${node.id}-${actionResetKey}`}
                node={node}
                updateNodeData={updateNodeData}
              />
            )}

            {node.type === "start" && (
              <StartInspector node={node} updateNodeData={updateNodeData} />
            )}

            {node.type === "condition" && (
              <ConditionInspector node={node} updateNodeData={updateNodeData} />
            )}
            {node.type === "router" && (
              <RouterInspector key={node.id} node={node as any} updateNodeData={updateNodeData} />
            )}
            {node.type === "script" && (
              <ScriptInspector node={node} updateNodeData={updateNodeData} />
            )}
            {node.type === "functionCall" && (
              <FunctionCallInspector
                key={node.id}
                node={node as any}
                updateNodeData={updateNodeData}
              />
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              className="px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isScriptNameMissing}
              title={isScriptNameMissing ? "Script node name is required." : undefined}
              onClick={async () => {
                if (isScriptNameMissing) {
                  toast.error("Script node name is required.");
                  return;
                }
                if (!selectedNodeId) {
                  closeInspector();
                  return;
                }
                try {
                  const nodeToSync = nodes.find((n) => n.id === selectedNodeId);
                  const parentGroupId = nodeToSync?.parentNode;
                  const groupChildren = parentGroupId
                    ? nodes.filter((n) => n.parentNode === parentGroupId)
                    : [];
                  const startNode = groupChildren.find((n) => n.type === "start");
                  const flowName = (startNode?.data as { flowName?: string } | undefined)?.flowName;

                  if (!flowName) {
                    toast.error("Flow name not found.");
                    return;
                  }
                  if (user && !user.isAdmin) {
                    const hasPermission = await checkMyFlowPermission(
                      flowName,
                      user.userId ?? ""
                    );
                    if (!hasPermission) {
                      toast.error("You don't have permission to update this flow.");
                      if (originalDataRef.current) {
                        setNodes((prev) =>
                          prev.map((entry) =>
                            entry.id === selectedNodeId
                              ? { ...entry, data: originalDataRef.current ?? entry.data }
                              : entry
                          )
                        );
                      }
                      closeInspector();
                      return;
                    }
                  }

                  syncNodeWithBackend(selectedNodeId, originalNameRef.current);
                  closeInspector();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to verify permissions."
                  );
                }
              }}
            >
              Done
            </button>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group flex items-end justify-end p-1 z-50"
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-gray-300 group-hover:border-indigo-500 transition-colors"></div>
        </div>

        {/* arrow pointing to the node */}
        {/* arrow pointing to the node (below modal: small triangle) */}
        {inspectorPosition?.placement !== "below" && offset.x === 0 && offset.y === 0 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -8,
              transform: "translateX(-50%)",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: "9px solid #fff",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
              }}
            />
          </div>
        )}

        {/* arrow pointing up (when modal is below the node) */}
        {inspectorPosition?.placement === "below" && offset.x === 0 && offset.y === 0 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -8,
              transform: "translateX(-50%) rotate(180deg)",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: "9px solid #fff",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
