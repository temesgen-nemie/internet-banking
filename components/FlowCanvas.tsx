"use client";

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
} from "reactflow";
import {
  useCallback,
  useEffect,
  useRef,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useState,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useFlowStore } from "../store/flow/flowStore";
import { useAuthStore } from "../store/authStore";
import { checkMyFlowPermission } from "../lib/api";
import PromptNode from "./nodes/PromptNode";
import ActionNode from "./nodes/ActionNode";
import StartNode from "./nodes/StartNode";
import GroupNode from "./nodes/GroupNode";
import ConditionNode from "./nodes/ConditionNode";
import ScriptNode from "./nodes/ScriptNode";
import GroupNamerModal from "./modals/GroupNamerModal";
import GroupJsonModal from "./modals/GroupJsonModal";
import DeleteConfirmModal from "./modals/DeleteConfirmModal";
import RefreshConfirmModal from "./modals/RefreshConfirmModal";
import FlowBreadcrumb from "./FlowBreadcrumb";
import FlowPermissionsDialog from "./permissions/FlowPermissionsDialog";
import "reactflow/dist/style.css";

const nodeTypes = {
  prompt: PromptNode,
  action: ActionNode,
  start: StartNode,
  group: GroupNode,
  condition: ConditionNode,
  script: ScriptNode,
};

export default function FlowCanvas() {
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const { resolvedTheme } = useTheme();
  const backgroundDotColor =
    resolvedTheme === "dark" ? "rgba(255, 255, 255, 004)" : "rgba(15, 23, 42, 0.8)";
  const { user } = useAuthStore();

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    flowName: string;
  }>({ isOpen: false, flowName: "" });
  const [permissionsDialog, setPermissionsDialog] = useState<{
    open: boolean;
    flowName: string | null;
  }>({ open: false, flowName: null });

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedNodeId,
    selectedNodeId,
    removeNode,
    removeNodes,
    removeEdges,
    addNode,
    openInspector,
    updateNodeData,
    closeInspector,
    inspectorOpen,
    setRfInstance,
    currentSubflowId,
    enterSubflow,
    exitSubflow,
    openNamer,
    ungroupNodes,
    openGroupJson,
    publishGroup,
    namerModal,
    groupJsonModal,
    loadAllFlows,
    isLoading,
    _hasHydrated,
    copyNodes,
    pasteNodes,
    clipboard,
    publishedGroupIds,
    modifiedGroupIds,
    openRefreshConfirm,
  } = useFlowStore();

  // Filter nodes and edges based on subflow level
  // Strip parentNode reference from visible nodes so React Flow treats them as top-level in drill-down view
  const visibleNodes = useMemo(() => {
    return nodes
      .filter((n) => (n.parentNode || null) === (currentSubflowId || null))
      .map((n) => (currentSubflowId ? { ...n, parentNode: undefined } : n));
  }, [nodes, currentSubflowId]);

  // Edges are visible if both source and target are in the current view
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => {
      const s = nodes.find((n) => n.id === e.source);
      const t = nodes.find((n) => n.id === e.target);
      return (
        (s?.parentNode || null) === (currentSubflowId || null) &&
        (t?.parentNode || null) === (currentSubflowId || null)
      );
    });
  }, [edges, nodes, currentSubflowId]);

  // Context Menu Handlers
  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      event.preventDefault();

      const selectedNodes = visibleNodes.filter((n) => n.selected);
      const isPartofSelection = selectedNodes.some((n) => n.id === node.id);

      // If we right click a node that is part of a multi-selection, show the Grouping menu
      if (selectedNodes.length > 1 && isPartofSelection) {
        setMenu({
          id: "selection",
          top: event.clientY,
          left: event.clientX,
        });
      }
      // Viewport-aware positioning
      const menuWidth = 224; // w-56
      const menuHeight = 350; // estimate
      let left = event.clientX;
      let top = event.clientY;

      if (left + menuWidth > window.innerWidth) left -= menuWidth;
      if (top + menuHeight > window.innerHeight) top -= menuHeight;

      // Show menu for all node types
      setMenu({
        id: node.id,
        top,
        left,
      });
    },
    [visibleNodes, setMenu]
  );

  const onPaneContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      const selectedNodes = visibleNodes.filter((n) => n.selected);

      // Viewport-aware positioning
      const menuWidth = 224; // w-56
      const menuHeight = 200; // estimate for pane menu
      let left = event.clientX;
      let top = event.clientY;

      if (left + menuWidth > window.innerWidth) left -= menuWidth;
      if (top + menuHeight > window.innerHeight) top -= menuHeight;

      if (selectedNodes.length > 1) {
        setMenu({
          id: "selection",
          top,
          left,
        });
      } else {
        // Show "Empty Group / Paste" menu
        setMenu({
          id: "pane",
          top,
          left,
        });
      }
    },
    [visibleNodes, setMenu]
  );

  // add edge (uses current edges array)
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);

      // Visual Branching Logic:
      if (params.sourceHandle) {
        // 1. Prompt Options
        if (sourceNode && sourceNode.type === "prompt") {
          const handleId = params.sourceHandle;

          // Handle Prompt Node "fallback" or "default" handle
          if (!handleId || handleId === "default" || handleId === "fallback") {
            const targetNode = nodes.find((n) => n.id === params.target);
            if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
              toast.error("Unnamed Target Node", {
                description: "The target node must have a name before you can connect to it.",
                duration: 5000,
              });
              return; // REJECT CONNECTION
            }

            const currentNextNode = sourceNode.data.nextNode as
              | { routes?: Array<Record<string, unknown>>; default?: string }
              | string
              | undefined;
            const isMenuMode =
              !!currentNextNode &&
              typeof currentNextNode === "object" &&
              Array.isArray(currentNextNode.routes);
            if (isMenuMode) {
              const nextNodeWithRoutes = currentNextNode as {
                routes?: Array<Record<string, unknown>>;
                default?: string;
              };
              updateNodeData(sourceNode.id, {
                nextNode: {
                  ...nextNodeWithRoutes,
                  default: params.target,
                },
              });
            } else {
              updateNodeData(sourceNode.id, {
                nextNode: params.target,
              });
            }
          } else {
            const targetNode = nodes.find((n) => n.id === params.target);

            // VALIDATION: If connecting to a Menu Branch Group, check for Start node
            if (targetNode && targetNode.type === "group" && targetNode.data.isMenuBranch) {
              const children = nodes.filter((n) => n.parentNode === targetNode.id);
              const hasStartNode = children.some((n) => n.type === "start");

              if (!hasStartNode) {
                toast.error("Invalid Menu Branch", {
                  description: `Target group '${
                    targetNode.data.name || "Untitled"
                  }' must contain a Start node to be used as a menu branch destination.`,
                  duration: 5000,
                });
                return; // REJECT CONNECTION
              }
            }

            interface PromptNextNode {
              routes?: { when?: { eq?: string[] }; gotoFlow?: string; gotoId?: string }[];
              default?: string;
            }
            const nextNode = sourceNode.data.nextNode as PromptNextNode;

            // Explicitly check for routes array
            if (nextNode && typeof nextNode === "object" && Array.isArray(nextNode.routes)) {
              const routePart = handleId.split("-")[1];
              const routeIdx = parseInt(routePart, 10);
              const newRoutes = [...nextNode.routes];
              const route = !isNaN(routeIdx) ? newRoutes[routeIdx] : undefined;

              if (route) {
                let finalName = "";

                // SYNC LOGIC: If connecting to a Menu Branch Group
                if (targetNode && targetNode.type === "group" && targetNode.data.isMenuBranch) {
                  // ... Group Sync Logic ...
                  const targetName = targetNode.data.name;
                  const isDefaultTargetName = !targetName || targetName === "Untitled Group";

                  finalName =
                    route.gotoFlow ||
                    (!isDefaultTargetName ? targetName : "") ||
                    route.when?.eq?.[1] ||
                    "Branch";

                  // Update Group Name (Sync)
                  updateNodeData(targetNode.id, { name: finalName });

                  // Update Internal Start Node flowName
                  const children = nodes.filter((n) => n.parentNode === targetNode.id);
                  const startNode = children.find((n) => n.type === "start");
                  if (startNode) {
                    updateNodeData(startNode.id, { flowName: finalName });
                  }
                } else if (targetNode && targetNode.type !== "group") {
                  // NEW: Rename non-group target node to match the route's value
                  // We prioritize ONLY gotoFlow as per user request
                  const newName = route.gotoFlow;

                  if (!newName) {
                    toast.error("Invalid Branch", {
                      description: "Please define a name in the branch.",
                      duration: 4000,
                    });
                    return; // REJECT/ABORT SYNC if no name
                  }
                  finalName = newName;
                  updateNodeData(targetNode.id, { name: finalName });
                } else {
                  // Fallback / legacy non-branch
                  finalName =
                    route.gotoFlow ||
                    (targetNode?.data.name && targetNode.data.name !== "Untitled Group"
                      ? targetNode.data.name
                      : "");
                }

                // Update the route itself with the final name (without goto prefix)
                newRoutes[routeIdx] = {
                  ...route,
                  gotoFlow: finalName || targetNode?.id || "",
                  gotoId: finalName ? targetNode?.id : "",
                };
                updateNodeData(sourceNode.id, {
                  nextNode: { ...nextNode, routes: newRoutes },
                });
              }
            }
          }
        }
        // 2. Action Routes
        else if (sourceNode && sourceNode.type === "action") {
          const handleId = params.sourceHandle;
          // Check if it's the default handle
          if (handleId === "default") {
            const targetNode = nodes.find((n) => n.id === params.target);
            if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
              toast.error("Unnamed Target Node", {
                description: "The target node must have a name before you can connect to it.",
                duration: 5000,
              });
              return; // REJECT CONNECTION
            }
            updateNodeData(sourceNode.id, { nextNode: params.target });
          } else {
            // It's a conditional route
            interface ActionRoute {
              id: string;
              nextNodeId?: string;
            }
            const routes = (sourceNode.data.routes as ActionRoute[]) || [];
            const routeIndex = routes.findIndex((r) => r.id === handleId);

            if (routeIndex !== -1) {
              const newRoutes = [...routes];
              newRoutes[routeIndex] = {
                ...newRoutes[routeIndex],
                nextNodeId: params.target || "",
              };
              updateNodeData(sourceNode.id, { routes: newRoutes });
            }
          }
        }
        // 3. Script Routes
        else if (sourceNode && sourceNode.type === "script") {
          const handleId = params.sourceHandle;
          if (!handleId || handleId === "default") {
            const targetNode = nodes.find((n) => n.id === params.target);
            if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
              toast.error("Unnamed Target Node", {
                description: "The target node must have a name before you can connect to it.",
                duration: 5000,
              });
              return; // REJECT CONNECTION
            }
            updateNodeData(sourceNode.id, { nextNode: params.target });
          } else {
            interface ScriptRoute {
              id: string;
              key?: string;
              nextNodeId?: string;
            }
            const routes = (sourceNode.data.routes as ScriptRoute[]) || [];
            const routeIndex = routes.findIndex((r) => r.id === handleId);
            if (routeIndex !== -1) {
              const newRoutes = [...routes];
              newRoutes[routeIndex] = {
                ...newRoutes[routeIndex],
                nextNodeId: params.target || "",
              };
              updateNodeData(sourceNode.id, { routes: newRoutes });
            }
          }
        }
        // 4. Condition Routes
        else if (sourceNode && sourceNode.type === "condition") {
          const handleId = params.sourceHandle;
          if (handleId === "default") {
            const targetNode = nodes.find((n) => n.id === params.target);
            if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
              toast.error("Unnamed Target Node", {
                description: "The target node must have a name before you can connect to it.",
                duration: 5000,
              });
              return; // REJECT CONNECTION
            }
            updateNodeData(sourceNode.id, {
              nextNode: {
                ...((sourceNode.data.nextNode as object) || {}),
                default: params.target,
              },
            });
          } else {
            // It's a specific route handle (route-0, route-1)
            interface ConditionRoute {
              goto?: string;
              when?: any;
            }
            interface ConditionNext {
              routes?: ConditionRoute[];
              default?: string;
            }

            const nextNode = sourceNode.data.nextNode as ConditionNext;
            const routeIdx = parseInt(handleId.split("-")[1]);

            if (nextNode && nextNode.routes && nextNode.routes[routeIdx]) {
              const newRoutes = [...nextNode.routes];

              // Helper: Resolve Target Name
              const targetNode = nodes.find((n) => n.id === params.target);
              let targetName = targetNode?.data.name;

              // Use ID if no name
              if (!targetName || targetName === "Untitled Group") {
                targetName = params.target;
              }

              newRoutes[routeIdx] = {
                ...newRoutes[routeIdx],
                goto: String(targetName),
              };

              updateNodeData(sourceNode.id, {
                nextNode: { ...nextNode, routes: newRoutes },
              });
            }
          }
        }
      } else {
        // If no specific handle ID is used (default/legacy handles)

        // Prompt Node Logic (Linear Mode/Default)
        if (sourceNode && sourceNode.type === "prompt") {
          const targetNode = nodes.find((n) => n.id === params.target);
          if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
            toast.error("Unnamed Target Node", {
              description: "The target node must have a name before you can connect to it.",
              duration: 5000,
            });
            return; // REJECT CONNECTION
          }
          updateNodeData(sourceNode.id, { nextNode: params.target });
        }
        // Action Node Logic (legacy fallback or default handle if no ID)
        else if (sourceNode && sourceNode.type === "action") {
          const targetNode = nodes.find((n) => n.id === params.target);
          if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
            toast.error("Unnamed Target Node", {
              description: "The target node must have a name before you can connect to it.",
              duration: 5000,
            });
            return; // REJECT CONNECTION
          }
          updateNodeData(sourceNode.id, { nextNode: params.target });
        }
        // Script Node Logic
        else if (sourceNode && sourceNode.type === "script") {
          const targetNode = nodes.find((n) => n.id === params.target);
          if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
            toast.error("Unnamed Target Node", {
              description: "The target node must have a name before you can connect to it.",
              duration: 5000,
            });
            return; // REJECT CONNECTION
          }
          updateNodeData(sourceNode.id, { nextNode: params.target });
        }
        // Start Node Logic:
        else if (sourceNode && sourceNode.type === "start") {
          const targetNode = nodes.find((n) => n.id === params.target);
          if (targetNode && !targetNode.data.name && targetNode.type !== "group") {
            toast.error("Unnamed Entry Node", {
              description: "The entry node must have a name before you can connect to it.",
              duration: 5000,
            });
            return; // REJECT CONNECTION
          }
          updateNodeData(sourceNode.id, { entryNode: params.target });
        }
      }

      // Finally, add the edge if we haven't returned early (rejected)
      setEdges(addEdge(params, edges));
    },
    [edges, setEdges, nodes, updateNodeData, removeEdges]
  );

  // Handle edge deletion logic via store action
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      removeEdges(deletedEdges.map((e) => e.id));
    },
    [removeEdges]
  );

  // node drag / move / selection: apply change objects to current `nodes`
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(applyNodeChanges(changes, nodes)),
    [nodes, setNodes]
  );

  // edge changes: apply change objects to current `edges`
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, edges)),
    [edges, setEdges]
  );

  // selection
  const onSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => {
      setSelectedNodeId(nodes[0]?.id ?? null);
    },
    [setSelectedNodeId]
  );

  // also select node on click (helps when selectionChange doesn't fire)
  const onNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setMenu(null);
    },
    [setSelectedNodeId]
  );

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const hasStartInView = nodes.some(
        (n) => n.type === "start" && (n.parentNode || null) === (currentSubflowId || null)
      );
      if (type === "start" && hasStartInView) {
        toast.error("Only one Start node is allowed per flow.");
        return;
      }

      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position =
        bounds && rfInstanceRef.current
          ? rfInstanceRef.current.project({
              x: event.clientX - bounds.left,
              y: event.clientY - bounds.top,
            })
          : { x: event.clientX, y: event.clientY };

      let data: Record<string, unknown> = {};
      if (type === "prompt") {
        data = { message: "", nextNode: { routes: [], default: "" } };
      } else if (type === "action") {
        data = { endpoint: "", requestSource: "api" };
      } else if (type === "script") {
        data = { name: "", script: "", timeoutMs: 25, nextNode: "", routes: [] };
      } else if (type === "start") {
        data = { flowName: "", entryNode: "" };
      } else if (type === "group") {
        data = { name: "Untitled Group" };
      } else if (type === "condition") {
        data = { name: "", nextNode: { routes: [], default: "" } };
      }

      addNode({
        id: uuidv4(),
        type,
        position,
        data,
        parentNode: currentSubflowId ?? undefined,
      });
    },
    [addNode, currentSubflowId, nodes]
  );

  // open inspector on double-click
  const onNodeDoubleClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (node.type === "group") {
        enterSubflow(node.id);
        return;
      }
      try {
        if (rfInstanceRef.current) {
          // Center the node while explicitly preserving the current zoom level
          const position = node.positionAbsolute ?? node.position;
          const centerX = position.x + (node.width ?? 150) / 2;
          const centerY = position.y + (node.height ?? 80) / 2;
          const zoom = rfInstanceRef.current.getZoom();

          rfInstanceRef.current.setCenter(centerX, centerY, {
            zoom,
            duration: 200,
          });

          // Wait for animation to finish before opening inspector
          setTimeout(() => openInspector(node.id), 240);
        } else {
          openInspector(node.id);
        }
      } catch (e) {
        openInspector(node.id);
      }
    },
    [openInspector, enterSubflow]
  );

  // Update inspector position while dragging
  const onNodeDrag = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      // Only update position if inspector is ALREADY open
      if (node.id === selectedNodeId && inspectorOpen) {
        openInspector(node.id);
      }
    },
    [selectedNodeId, inspectorOpen, openInspector]
  );

  // Close inspector when clicking on the empty canvas pane
  const onPaneClick = useCallback(() => {
    closeInspector();
    setMenu(null);
  }, [closeInspector]);

  // delete selected node with Delete/Backspace key, close inspector with Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement // Optional: might want to allow shortcuts on buttons? strict is safer
      ) {
        // Only allow Escape to blur/close even if focused?
        // Usually Escape works everywhere.
        if (e.key === "Escape") {
          // allow pass through to close inspector
        } else {
          return;
        }
      }

      // Prevent repeating actions if key is held down (e.g. holding V pastes 50 times)
      if (e.repeat) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodeIds = visibleNodes.filter((n) => n.selected).map((n) => n.id);
        const selectedEdges = visibleEdges.filter((edge) => edge.selected);

        // Handle Node Deletion
        if (selectedNodeIds.length > 0) {
          removeNodes(selectedNodeIds);
        }

        // Handle Edge Deletion
        if (selectedEdges.length > 0) {
          removeEdges(selectedEdges.map((edge) => edge.id));
        }
      } else if (e.key === "Escape") {
        // Close the inspector if open
        closeInspector();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        const visibleNodeIds = new Set(
          nodes
            .filter((n) => (n.parentNode || null) === (currentSubflowId || null))
            .map((n) => n.id)
        );
        setNodes((prev) =>
          prev.map((n) => ({
            ...n,
            selected: visibleNodeIds.has(n.id),
          }))
        );
        setEdges((prev) =>
          prev.map((e) => ({
            ...e,
            selected: visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
          }))
        );
        const firstSelected = nodes.find((n) => visibleNodeIds.has(n.id))?.id;
        setSelectedNodeId(firstSelected ?? null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedNodeId) {
          // Check if multiple are selected via internal state or just pass selection
          // ReactFlow handles selection state on nodes. We can find selected.
          // Note: visibleNodes has the 'selected' property updated by ReactFlow
          const selected = visibleNodes.filter((n) => n.selected).map((n) => n.id);
          if (selected.length > 0) {
            copyNodes(selected);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        pasteNodes();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedNodeId,
    removeNodes,
    removeEdges,
    closeInspector,
    copyNodes,
    pasteNodes,
    visibleNodes,
    visibleEdges,
    setNodes,
    setEdges,
    nodes,
    currentSubflowId,
    setSelectedNodeId,
  ]);

  // Auto-load flows on mount
  useEffect(() => {
    if (_hasHydrated) {
      loadAllFlows();
    }
  }, [loadAllFlows, _hasHydrated]);

  // Auto-center/fit view when navigating subflows
  useEffect(() => {
    if (_hasHydrated && rfInstanceRef.current) {
      // Small timeout to ensure visibleNodes have updated and rendered
      const timer = setTimeout(() => {
        rfInstanceRef.current?.fitView({
          duration: 400,
          padding: 0.2,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentSubflowId, _hasHydrated]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full relative group"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <FlowBreadcrumb currentSubflowId={currentSubflowId} nodes={nodes} onNavigate={exitSubflow} />

      {/* Auto-Load / Refresh Button */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => {
            const hasPublishedChanges = modifiedGroupIds.some((id) =>
              publishedGroupIds.includes(id)
            );
            if (hasPublishedChanges) {
              openRefreshConfirm("global");
            } else {
              loadAllFlows();
            }
          }}
          disabled={isLoading}
          className="p-2 bg-white/90 backdrop-blur-xl shadow-lg border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-gray-500 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed group"
          title="Refresh Flows from Backend"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 ${
              isLoading
                ? "animate-spin"
                : "group-hover:rotate-180 transition-transform duration-500"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDrag={onNodeDrag}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onInit={(inst) => {
          rfInstanceRef.current = inst;
          setRfInstance(inst);
        }}
        fitView
        minZoom={0.2}
        deleteKeyCode={null}
      >
        <Background gap={20} color={backgroundDotColor} />
        <Controls className="bg-white border-2 border-gray-100 shadow-xl rounded-xl" />
        <MiniMap
          pannable
          zoomable
          className="border-2 border-gray-100 cursor-pointer shadow-xl rounded-2xl overflow-hidden"
        />

        {/* Global Context Menu UI */}
        {menu && (
          <div
            style={{ top: menu.top, left: menu.left }}
            className="fixed z-1000 bg-white/95 backdrop-blur-xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] rounded-2xl border border-indigo-50 py-1.5 w-56 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            onClick={() => setMenu(null)}
          >
            {menu.id === "selection" ? (
              <button
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-all group/item"
                onClick={() => {
                  const selectedIds = visibleNodes.filter((n) => n.selected).map((n) => n.id);
                  openNamer(selectedIds);
                }}
              >
                <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                Group Selected Nodes
              </button>
            ) : menu.id === "pane" ? (
              <div className="flex flex-col gap-0.5">
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-all group/item"
                  onClick={() => {
                    // Open namer with empty array to signify "Create Empty Group"
                    openNamer([]);
                  }}
                >
                  <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  Create Empty Group
                </button>
                {clipboard && clipboard.length > 0 && (
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-all group/item"
                    onClick={() => {
                      pasteNodes();
                      setMenu(null);
                    }}
                  >
                    <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                    Paste Nodes
                  </button>
                )}
              </div>
            ) : (
              <>
                {nodes.find((n) => n.id === menu.id)?.type === "group" && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-all group/item"
                      onClick={() => enterSubflow(menu.id)}
                    >
                      <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
                          />
                        </svg>
                      </div>
                      Enter Group
                    </button>
                    <button
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold transition-all group/item ${
                        nodes.find((n) => n.id === menu.id)?.data.isMenuBranch
                          ? "text-indigo-600 hover:bg-indigo-50"
                          : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      onClick={async () => {
                        const groupNode = nodes.find((n) => n.id === menu.id);
                        if (!groupNode) return;
                        const children = nodes.filter((n) => n.parentNode === menu.id);
                        const startNode = children.find((n) => n.type === "start");
                        const flowName = (startNode?.data as { flowName?: string } | undefined)
                          ?.flowName;
                        if (!flowName) {
                          toast.error("Flow name not found.");
                          return;
                        }
                        if (!user?.userId) {
                          toast.error("Missing user information.");
                          return;
                        }
                        try {
                          if (!user.isAdmin) {
                            const hasPermission = await checkMyFlowPermission(
                              flowName,
                              user.userId
                            );
                            if (!hasPermission) {
                              toast.error("You don't have permission to update this flow.");
                              return;
                            }
                          }
                          updateNodeData(groupNode.id, {
                            isMenuBranch: !groupNode.data.isMenuBranch,
                          });
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Failed to verify permissions."
                          );
                        }
                      }}
                    >
                      <div
                        className={`p-1.5 rounded-lg group-hover/item:text-white transition-colors ${
                          nodes.find((n) => n.id === menu.id)?.data.isMenuBranch
                            ? "bg-indigo-100 group-hover/item:bg-indigo-600"
                            : "bg-emerald-100 group-hover/item:bg-emerald-600"
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                      </div>
                      {nodes.find((n) => n.id === menu.id)?.data.isMenuBranch
                        ? "Convert to Subflow"
                        : "Convert to Menu Branch"}
                    </button>
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-emerald-600 hover:bg-emerald-50 font-bold transition-all group/item"
                      onClick={() => openGroupJson(menu.id)}
                    >
                      <div className="p-1.5 bg-emerald-100 rounded-lg group-hover/item:bg-emerald-600 group-hover/item:text-white transition-colors">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                      </div>
                      View Group JSON
                    </button>
                    {(() => {
                      const children = nodes.filter((n) => n.parentNode === menu.id);
                      const startNode = children.find((n) => n.type === "start");
                      const flowName = (startNode?.data as { flowName?: string } | undefined)
                        ?.flowName;
                      if (!user?.isAdmin) return null;

                      return (
                        <button
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-sky-600 hover:bg-sky-50 font-bold transition-all group/item"
                          onClick={() => {
                            if (!flowName) {
                              toast.error("Flow name not found.");
                              return;
                            }
                            setPermissionsDialog({ open: true, flowName });
                            setMenu(null);
                          }}
                        >
                          <div className="p-1.5 bg-sky-100 rounded-lg group-hover/item:bg-sky-600 group-hover/item:text-white transition-colors">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M12 6V4m0 0a2 2 0 00-2 2m2-2a2 2 0 012 2m-2 0v2m0 4v6m0 0a2 2 0 002 2m-2-2a2 2 0 01-2 2m0-8H6m0 0a2 2 0 012-2m-2 2a2 2 0 002 2m8-2h2m0 0a2 2 0 00-2-2m2 2a2 2 0 01-2 2"
                              />
                            </svg>
                          </div>
                          Manage Access
                        </button>
                      );
                    })()}
                    {(() => {
                      // const groupNode = nodes.find((n) => n.id === menu.id);
                      const children = nodes.filter((n) => n.parentNode === menu.id);
                      const startNode = children.find((n) => n.type === "start");
                      const flowName = (startNode?.data as any)?.flowName;
                      const isPublished = publishedGroupIds.includes(menu.id);
                      const isModified = modifiedGroupIds.includes(menu.id);

                      if (!isPublished) {
                        return (
                          <button
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-violet-600 hover:bg-violet-50 font-bold transition-all group/item border-b border-gray-50"
                            onClick={() => publishGroup(menu.id)}
                          >
                            <div className="p-1.5 bg-violet-100 rounded-lg group-hover/item:bg-violet-600 group-hover/item:text-white transition-colors">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                              </svg>
                            </div>
                            Publish to Backend
                          </button>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-0.5">
                          <button
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-all group/item border-b border-gray-50"
                            onClick={async () => {
                              if (!flowName) {
                                toast.error("Flow name not found.");
                                return;
                              }
                              if (!user?.userId) {
                                toast.error("Missing user information.");
                                return;
                              }
                              try {
                                if (!user.isAdmin) {
                                  const hasPermission = await checkMyFlowPermission(
                                    flowName,
                                    user.userId
                                  );
                                  if (!hasPermission) {
                                    toast.error("You don't have permission to update this flow.");
                                    return;
                                  }
                                }
                                useFlowStore.getState().updatePublishedFlow(menu.id);
                                setMenu(null);
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to verify permissions."
                                );
                              }
                            }}
                          >
                            <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </div>
                            <div className="flex flex-col items-start translate-y-px">
                              <span>Update to Backend</span>
                              <span className="text-[9px] text-indigo-400 font-medium leading-none">
                                {isModified
                                  ? `Sync changes for '${flowName}'`
                                  : `Re-sync '${flowName}'`}
                              </span>
                            </div>
                          </button>
                          <button
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold transition-all group/item border-b border-gray-50"
                            onClick={async () => {
                              if (!flowName) {
                                toast.error("Flow name not found.");
                                return;
                              }
                              if (!user?.userId) {
                                toast.error("Missing user information.");
                                return;
                              }
                              try {
                                if (!user.isAdmin) {
                                  const hasPermission = await checkMyFlowPermission(
                                    flowName,
                                    user.userId
                                  );
                                  if (!hasPermission) {
                                    toast.error("You don't have permission to delete this flow.");
                                    return;
                                  }
                                }
                                setDeleteModal({ isOpen: true, flowName });
                                setMenu(null);
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to verify permissions."
                                );
                              }
                            }}
                          >
                            <div className="p-1.5 bg-rose-100 rounded-lg group-hover/item:bg-rose-600 group-hover/item:text-white transition-colors">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </div>
                            Delete Backend Flow
                          </button>
                        </div>
                      );
                    })()}
                    {(() => {
                      const groupNode = nodes.find((n) => n.id === menu.id);
                      const children = nodes.filter((n) => n.parentNode === menu.id);
                      const hasStartInChildren = children.some((n) => n.type === "start");
                      const parentId = groupNode?.parentNode || null;
                      const parentHasStart = nodes.some(
                        (n) => n.type === "start" && (n.parentNode || null) === (parentId || null)
                      );
                      const isUngroupBlocked = hasStartInChildren && parentHasStart;

                      return (
                        <button
                          disabled={isUngroupBlocked}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold transition-all group/item ${
                            isUngroupBlocked
                              ? "text-gray-400 cursor-not-allowed bg-gray-50"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                          onClick={async () => {
                            if (isUngroupBlocked) return;
                            const startNode = children.find((n) => n.type === "start");
                            const flowName = (startNode?.data as { flowName?: string } | undefined)
                              ?.flowName;
                            if (!flowName) {
                              toast.error("Flow name not found.");
                              return;
                            }
                            if (!user?.userId) {
                              toast.error("Missing user information.");
                              return;
                            }
                            try {
                              if (!user.isAdmin) {
                                const hasPermission = await checkMyFlowPermission(
                                  flowName,
                                  user.userId
                                );
                                if (!hasPermission) {
                                  toast.error("You don't have permission to update this flow.");
                                  return;
                                }
                              }
                              ungroupNodes(menu.id);
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to verify permissions."
                              );
                            }
                          }}
                        >
                          <div
                            className={`p-1.5 rounded-lg transition-colors ${
                              isUngroupBlocked
                                ? "bg-gray-200 text-gray-400"
                                : "bg-red-100 group-hover/item:bg-red-600 group-hover/item:text-white"
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 14c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                          <div className="flex flex-col items-start translate-y-px">
                            <span>Ungroup Items</span>
                            {isUngroupBlocked && (
                              <span className="text-[9px] font-medium text-red-500 leading-none">
                                Parent level already has a Start node
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })()}
                  </div>
                )}
                {nodes.find((n) => n.id === menu.id)?.type !== "group" && (
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-bold transition-all group/item"
                    onClick={() => removeNode(menu.id)}
                  >
                    <div className="p-1.5 bg-red-100 rounded-lg group-hover/item:bg-red-600 group-hover/item:text-white transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </div>
                    Delete Node
                  </button>
                )}

                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-all group/item border-t border-gray-50"
                  onClick={() => {
                    copyNodes([menu.id]);
                    setMenu(null);
                  }}
                >
                  <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                  </div>
                  Copy Node
                </button>
              </>
            )}
          </div>
        )}
      </ReactFlow>

      {/* Modals */}
      {namerModal?.isOpen && <GroupNamerModal />}
      {groupJsonModal?.isOpen && <GroupJsonModal />}
      <RefreshConfirmModal />
      {deleteModal.isOpen && (
        <DeleteConfirmModal
          flowName={deleteModal.flowName}
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, flowName: "" })}
        />
      )}
      <FlowPermissionsDialog
        open={permissionsDialog.open}
        onOpenChange={(open) => setPermissionsDialog((prev) => ({ ...prev, open }))}
        flowName={permissionsDialog.flowName}
      />
    </div>
  );
}
