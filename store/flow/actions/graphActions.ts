import { type Edge, type Node, type ReactFlowInstance } from "reactflow";
import { toast } from "sonner";

import {
  buildFlowJson,
  calculateFlowSnapshot,
  getParentGroupInfo,
  replaceNextNodeNameInScript,
} from "@/store/flow/serialization";
import type { FlowJson, FlowNode } from "@/store/flow/types";

type InspectorPosition = {
  x: number;
  y: number;
  placement: "above" | "below" | "center";
};

type GraphActionsState = {
  nodes: Node[];
  edges: Edge[];
  flow: FlowJson;
  currentSubflowId: string | null;
  modifiedGroupIds: string[];
  modifiedGroupsLog: Record<string, string[]>;
  publishedGroupIds: string[];
  lastSyncedSnapshots: Record<string, string>;
  selectedNodeId: string | null;
  inspectorOpen: boolean;
  inspectorPosition: InspectorPosition | null;
  rfInstance: ReactFlowInstance | null;
  removeNodes: (ids: string[]) => void;
};

type StoreSet = (
  partial:
    | Partial<GraphActionsState>
    | ((state: GraphActionsState) => Partial<GraphActionsState>)
) => unknown;
type StoreGet = () => GraphActionsState;

type GraphActions = {
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  rfInstance: ReactFlowInstance | null;
  setRfInstance: (instance: ReactFlowInstance) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  removeEdges: (ids: string[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  openInspector: (id: string) => void;
  closeInspector: () => void;
  setInspectorPosition: (pos: InspectorPosition | null) => void;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  isNameTaken: (name: string, excludeId?: string) => boolean;
};

export const createGraphActions = ({
  set,
  get,
}: {
  set: StoreSet;
  get: StoreGet;
}): GraphActions => ({
setNodes: (newNodesArg) =>
  set((state) => {
    const newNodes = typeof newNodesArg === 'function' ? newNodesArg(state.nodes) : newNodesArg;
    const correctedNodes = newNodes.map((n) => {
      const existing = state.nodes.find((e) => e.id === n.id);
      if (
        existing?.parentNode &&
        !n.parentNode &&
        state.currentSubflowId
      ) {
        return {
          ...n,
          parentNode: existing.parentNode,
          extent: existing.extent || "parent",
        };
      }
      return n;
    });

    // Change Detection: If any node moved, find its parent flow and mark as modified
    let nextModifiedGroupIds = [...state.modifiedGroupIds];
    const nextModifiedGroupsLog = { ...state.modifiedGroupsLog };

    // Identify which groups have moving nodes
    const affectedGroupIds = new Set<string>();
    correctedNodes.forEach((n) => {
      const existing = state.nodes.find((e) => e.id === n.id);
      if (existing && (existing.position.x !== n.position.x || existing.position.y !== n.position.y)) {
        const info = getParentGroupInfo(state.nodes, n.id);
        if (info && state.publishedGroupIds.includes(info.groupId)) {
          affectedGroupIds.add(info.groupId);
        }
      }
    });

    affectedGroupIds.forEach(groupId => {
      const currentSnapshot = calculateFlowSnapshot(groupId, correctedNodes, state.edges);
      const originalSnapshot = state.lastSyncedSnapshots[groupId];
      const isActuallyModified = currentSnapshot !== originalSnapshot;

      if (isActuallyModified) {
        if (!nextModifiedGroupIds.includes(groupId)) {
          nextModifiedGroupIds.push(groupId);
        }
        const groupLog = nextModifiedGroupsLog[groupId] || [];
        if (!groupLog.includes("Layout modified")) {
          groupLog.push("Layout modified");
        }
        nextModifiedGroupsLog[groupId] = groupLog;
      } else {
        nextModifiedGroupIds = nextModifiedGroupIds.filter(id => id !== groupId);
        nextModifiedGroupsLog[groupId] = [];
      }
    });

    return {
      nodes: correctedNodes,
      flow: buildFlowJson(correctedNodes, state.edges),
      modifiedGroupIds: nextModifiedGroupIds,
      modifiedGroupsLog: nextModifiedGroupsLog,
    };
  }),

setEdges: (edges) =>
  set((state) => {
    const nextEdges = typeof edges === 'function' ? edges(state.edges) : edges;
    const currentNodes = state.nodes;

    let nextModifiedGroupIds = [...state.modifiedGroupIds];
    const nextModifiedGroupsLog = { ...state.modifiedGroupsLog };

    // Determine which groups might be affected by edge changes
    const affectedGroupIds = new Set<string>();
    const allEdges = [...state.edges, ...nextEdges];
    allEdges.forEach(e => {
      const infoS = getParentGroupInfo(currentNodes, e.source);
      const infoT = getParentGroupInfo(currentNodes, e.target);
      if (infoS && state.publishedGroupIds.includes(infoS.groupId)) affectedGroupIds.add(infoS.groupId);
      if (infoT && state.publishedGroupIds.includes(infoT.groupId)) affectedGroupIds.add(infoT.groupId);
    });

    affectedGroupIds.forEach(groupId => {
      const currentSnapshot = calculateFlowSnapshot(groupId, currentNodes, nextEdges);
      const originalSnapshot = state.lastSyncedSnapshots[groupId];
      const isActuallyModified = currentSnapshot !== originalSnapshot;

      if (isActuallyModified) {
        if (!nextModifiedGroupIds.includes(groupId)) {
          nextModifiedGroupIds.push(groupId);
        }
        const groupLog = nextModifiedGroupsLog[groupId] || [];
        if (!groupLog.includes("Connections modified")) {
          groupLog.push("Connections modified");
        }
        nextModifiedGroupsLog[groupId] = groupLog;
      } else {
        nextModifiedGroupIds = nextModifiedGroupIds.filter(id => id !== groupId);
        nextModifiedGroupsLog[groupId] = [];
      }
    });

    return {
      edges: nextEdges,
      flow: buildFlowJson(currentNodes, nextEdges),
      modifiedGroupIds: nextModifiedGroupIds,
      modifiedGroupsLog: nextModifiedGroupsLog
    };
  }),

rfInstance: null,
setRfInstance: (instance) => set({ rfInstance: instance }),

addNode: (node) =>
  set((state) => {
    const newNode = {
      ...node,
      parentNode: state.currentSubflowId || undefined,
      extent: state.currentSubflowId ? ("parent" as const) : undefined,
    };
    const nextNodes = [...state.nodes, newNode];

    // Tracking modifications
    let nextModifiedGroupIds = state.modifiedGroupIds;
    const nextModifiedGroupsLog = { ...state.modifiedGroupsLog };
    if (state.currentSubflowId) {
      const info = getParentGroupInfo(nextNodes, newNode.id);
      if (info && state.publishedGroupIds.includes(info.groupId)) {
        const currentSnapshot = calculateFlowSnapshot(info.groupId, nextNodes, state.edges);
        const originalSnapshot = state.lastSyncedSnapshots[info.groupId];
        const isActuallyModified = currentSnapshot !== originalSnapshot;

        if (isActuallyModified) {
          if (!nextModifiedGroupIds.includes(info.groupId)) {
            nextModifiedGroupIds = [...nextModifiedGroupIds, info.groupId];
          }
          const groupLog = nextModifiedGroupsLog[info.groupId] || [];
          const nodeName = newNode.data?.name || newNode.data?.flowName || newNode.type;
          const newEntry = `Added ${newNode.type} node "${nodeName}"`;
          if (!groupLog.includes(newEntry)) {
            nextModifiedGroupsLog[info.groupId] = [...groupLog, newEntry];
          }
        } else {
          nextModifiedGroupIds = nextModifiedGroupIds.filter(id => id !== info.groupId);
          nextModifiedGroupsLog[info.groupId] = []; // Clear log if we returned to sync state
        }
      }
    }

    return {
      nodes: nextNodes,
      flow: buildFlowJson(nextNodes, state.edges),
      modifiedGroupIds: nextModifiedGroupIds,
      modifiedGroupsLog: nextModifiedGroupsLog,
    };
  }),

removeNode: (id) => get().removeNodes([id]),

removeNodes: (ids) =>
  set((state) => {
    const nodesToRemoveIds = new Set<string>(ids);

    // Identify all flows that might be modified BEFORE removing nodes
    const groupIdsToMark = new Set<string>();
    ids.forEach((id) => {
      const node = state.nodes.find((n) => n.id === id);
      if (node?.parentNode) {
        const info = getParentGroupInfo(state.nodes, node.id);
        if (info && state.publishedGroupIds.includes(info.groupId)) {
          groupIdsToMark.add(info.groupId);
        }
      }
    });

    // Iterative approach to identify all descendants at any depth for all starting IDs
    let changed = true;
    while (changed) {
      changed = false;
      state.nodes.forEach((n) => {
        if (n.parentNode && nodesToRemoveIds.has(n.parentNode)) {
          if (!nodesToRemoveIds.has(n.id)) {
            nodesToRemoveIds.add(n.id);
            changed = true;
          }
        }
      });
    }

    // ------------------------------------------------------------------
    // CLEANUP DATA: Clear references in source nodes pointing to deleted nodes
    // ------------------------------------------------------------------
    const edgesToRemove = state.edges.filter(
      (e) => nodesToRemoveIds.has(e.target) && !nodesToRemoveIds.has(e.source)
    );

    // We need a map to update nodes efficiently before filtering
    const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));

    const updateNodeDataLocal = (
      nodeId: string,
      updater: (data: Record<string, unknown>) => Record<string, unknown>
    ) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const currentData = (node.data as Record<string, unknown>) || {};
      const nextData = updater(currentData);
      if (nextData === currentData) return;
      nodeMap.set(nodeId, { ...node, data: nextData });
    };

    edgesToRemove.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      if (!sourceNode) return;

      const handle = edge.sourceHandle || "";

      // Action Node Cleanup
      if (sourceNode.type === "action") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => ({ ...data, nextNode: "" }));
        } else {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const routes = Array.isArray(data.routes) ? [...data.routes] : [];
            const idx = routes.findIndex((r) => (r as { id?: string })?.id === handle);
            if (idx === -1) return data;
            routes[idx] = { ...routes[idx], nextNodeId: "" };
            return { ...data, routes };
          });
        }
      }
      // Script Node Cleanup
      else if (sourceNode.type === "script") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => ({ ...data, nextNode: "" }));
        } else {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const routes = Array.isArray(data.routes) ? [...data.routes] : [];
            const idx = routes.findIndex((r) => (r as { id?: string })?.id === handle);
            if (idx === -1) return data;
            routes[idx] = { ...routes[idx], nextNodeId: "" };
            return { ...data, routes };
          });
        }
      }
      // Prompt Node Cleanup
      else if (sourceNode.type === "prompt") {
        if (handle.startsWith("route-")) {
          const routeIdx = parseInt(handle.split("-")[1], 10);
          if (!Number.isNaN(routeIdx)) {
            updateNodeDataLocal(sourceNode.id, (data) => {
              const nextNode =
                data.nextNode as
                  | { routes?: Array<Record<string, unknown>> }
                  | string
                  | undefined;
              if (!nextNode || typeof nextNode !== "object" || !nextNode.routes) return data;
              const routes = [...nextNode.routes];
              if (!routes[routeIdx]) return data;
              // PRESERVE gotoFlow (name), only clear the ID reference
              routes[routeIdx] = { ...routes[routeIdx], gotoId: "" };
              return { ...data, nextNode: { ...nextNode, routes } };
            });
          }
        } else {
          updateNodeDataLocal(sourceNode.id, (data) => ({ ...data, nextNode: "" }));
        }
      }
      // Condition Node Cleanup
      else if (sourceNode.type === "condition") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode =
              (data.nextNode as
                | { routes?: Array<Record<string, unknown>>; default?: string }
                | undefined) || {};
            return { ...data, nextNode: { ...nextNode, default: "", defaultId: "" } };
          });
        } else if (handle.startsWith("route-")) {
          const routeIdx = parseInt(handle.split("-")[1], 10);
          if (!Number.isNaN(routeIdx)) {
            updateNodeDataLocal(sourceNode.id, (data) => {
              const nextNode = data.nextNode as
                | { routes?: Array<Record<string, unknown>>; default?: string }
                | undefined;
              if (!nextNode || !nextNode.routes) return data;
              const routes = [...nextNode.routes];
              if (!routes[routeIdx]) return data;
              routes[routeIdx] = { ...routes[routeIdx], goto: "", gotoId: "" };
              return { ...data, nextNode: { ...nextNode, routes } };
            });
          }
        }
      }
      // Router Node Cleanup
      else if (sourceNode.type === "router") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode =
              (data.nextNode as
                | { routes?: Array<Record<string, unknown>>; default?: string; defaultId?: string }
                | undefined) || {};
            return { ...data, nextNode: { ...nextNode, default: "", defaultId: "" } };
          });
        } else if (handle.startsWith("route-")) {
          const routeIdx = parseInt(handle.split("-")[1], 10);
          if (Number.isNaN(routeIdx)) return;
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode = data.nextNode as
              | { routes?: Array<Record<string, unknown>>; default?: string; defaultId?: string }
              | undefined;
            if (!nextNode || !nextNode.routes) return data;
            const routes = [...nextNode.routes];
            if (!routes[routeIdx]) return data;
            routes[routeIdx] = { ...routes[routeIdx], goto: "", gotoId: "" };
            return { ...data, nextNode: { ...nextNode, routes } };
          });
        }
        return;
      }

      if (sourceNode.type === "start") {
        updateNodeDataLocal(sourceNode.id, (data) => ({
          ...data,
          entryNode: "",
          entryNodeId: "",
        }));
      }
    });

    // Use the updated nodeMap values for the nextNodes list
    const nextNodes = Array.from(nodeMap.values()).filter(
      (n) => !nodesToRemoveIds.has(n.id)
    );

    // If we are deleting the current subflow we are in, exit to main
    const nextSubflowId = nodesToRemoveIds.has(
      state.currentSubflowId || ""
    )
      ? null
      : state.currentSubflowId;

    const nextEdges = state.edges.filter(
      (e) =>
        !nodesToRemoveIds.has(e.source) && !nodesToRemoveIds.has(e.target)
    );

    let nextModifiedGroupIds = [...state.modifiedGroupIds];
    const nextModifiedGroupsLog = { ...state.modifiedGroupsLog };

    groupIdsToMark.forEach((groupId) => {
      const currentSnapshot = calculateFlowSnapshot(groupId, nextNodes, nextEdges);
      const originalSnapshot = state.lastSyncedSnapshots[groupId];
      const isActuallyModified = currentSnapshot !== originalSnapshot;

      if (isActuallyModified) {
        if (!nextModifiedGroupIds.includes(groupId)) {
          nextModifiedGroupIds.push(groupId);
        }
        // Log deletions
        const groupLog = nextModifiedGroupsLog[groupId] || [];
        ids.forEach(id => {
          const node = state.nodes.find(n => n.id === id);
          if (node) {
            const nodeName = node.data?.name || node.data?.flowName || node.type;
            const newEntry = `Deleted ${node.type} node "${nodeName}"`;
            if (!groupLog.includes(newEntry)) {
              groupLog.push(newEntry);
            }
          }
        });
        nextModifiedGroupsLog[groupId] = [...groupLog];
      } else {
        nextModifiedGroupIds = nextModifiedGroupIds.filter(id => id !== groupId);
        nextModifiedGroupsLog[groupId] = []; // Clear log if we returned to sync state
      }
    });

    return {
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: nodesToRemoveIds.has(state.selectedNodeId || "")
        ? null
        : state.selectedNodeId,
      currentSubflowId: nextSubflowId,
      flow: buildFlowJson(nextNodes, nextEdges),
      modifiedGroupIds: nextModifiedGroupIds.filter(id => !nodesToRemoveIds.has(id)),
      modifiedGroupsLog: nextModifiedGroupsLog,
    };
  }),

removeEdges: (ids) =>
  set((state) => {
    const edgeIdsToRemove = new Set(ids);
    const edgesToRemove = state.edges.filter((e) => edgeIdsToRemove.has(e.id));
    if (edgesToRemove.length === 0) {
      return {
        edges: state.edges,
        flow: buildFlowJson(state.nodes, state.edges),
      };
    }

    const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
    const nextModifiedGroupIds = [...state.modifiedGroupIds];

    const markGroupModified = (nodeId: string) => {
      const info = getParentGroupInfo(state.nodes, nodeId);
      if (
        info &&
        state.publishedGroupIds.includes(info.groupId) &&
        !nextModifiedGroupIds.includes(info.groupId)
      ) {
        nextModifiedGroupIds.push(info.groupId);
      }
    };

    const updateNodeDataLocal = (
      nodeId: string,
      updater: (data: Record<string, unknown>) => Record<string, unknown>
    ) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const currentData = (node.data as Record<string, unknown>) || {};
      const nextData = updater(currentData);
      if (nextData === currentData) return;
      nodeMap.set(nodeId, { ...node, data: nextData });
    };

    edgesToRemove.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      if (!sourceNode) return;

      markGroupModified(edge.source);
      markGroupModified(edge.target);

      const handle = edge.sourceHandle || "";

      if (sourceNode.type === "action") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => ({
            ...data,
            nextNode: "",
          }));
        } else {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const routes = Array.isArray(data.routes) ? [...data.routes] : [];
            const idx = routes.findIndex((r) => (r as { id?: string })?.id === handle);
            if (idx === -1) return data;
            routes[idx] = { ...routes[idx], nextNodeId: "" };
            return { ...data, routes };
          });
        }
        return;
      }

      if (sourceNode.type === "script") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => ({
            ...data,
            nextNode: "",
          }));
        } else {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const routes = Array.isArray(data.routes) ? [...data.routes] : [];
            const idx = routes.findIndex((r) => (r as { id?: string })?.id === handle);
            if (idx === -1) return data;
            routes[idx] = { ...routes[idx], nextNodeId: "" };
            return { ...data, routes };
          });
        }
        return;
      }

      if (sourceNode.type === "prompt") {
        if (handle.startsWith("route-")) {
          const routeIdx = parseInt(handle.split("-")[1], 10);
          if (Number.isNaN(routeIdx)) return;
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode =
              data.nextNode as
                | { routes?: Array<Record<string, unknown>> }
                | string
                | undefined;
            if (!nextNode || typeof nextNode !== "object" || !nextNode.routes) return data;
            const routes = [...nextNode.routes];
            if (!routes[routeIdx]) return data;
            // PRESERVE gotoFlow (name), only clear the ID reference
            routes[routeIdx] = { ...routes[routeIdx], gotoId: "" };
            return { ...data, nextNode: { ...nextNode, routes } };
          });
        } else {
          updateNodeDataLocal(sourceNode.id, (data) => ({
            ...data,
            nextNode: "",
          }));
        }
        return;
      }

      if (sourceNode.type === "condition") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode =
              (data.nextNode as
                | { routes?: Array<Record<string, unknown>>; default?: string }
                | undefined) || {};
            return { ...data, nextNode: { ...nextNode, default: "", defaultId: "" } };
          });
        } else if (handle.startsWith("route-")) {
          const routeIdx = parseInt(handle.split("-")[1], 10);
          if (Number.isNaN(routeIdx)) return;
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode = data.nextNode as
              | { routes?: Array<Record<string, unknown>>; default?: string }
              | undefined;
            if (!nextNode || !nextNode.routes) return data;
            const routes = [...nextNode.routes];
            if (!routes[routeIdx]) return data;
            routes[routeIdx] = { ...routes[routeIdx], goto: "", gotoId: "" };
            return { ...data, nextNode: { ...nextNode, routes } };
          });
        }
        return;
      }

      if (sourceNode.type === "router") {
        if (!handle || handle === "default") {
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode =
              (data.nextNode as
                | { routes?: Array<Record<string, unknown>>; default?: string }
                | undefined) || {};
            return { ...data, nextNode: { ...nextNode, default: "", defaultId: "" } };
          });
        } else if (handle.startsWith("route-")) {
          const routeIdx = parseInt(handle.split("-")[1], 10);
          if (Number.isNaN(routeIdx)) return;
          updateNodeDataLocal(sourceNode.id, (data) => {
            const nextNode = data.nextNode as
              | { routes?: Array<Record<string, unknown>>; default?: string }
              | undefined;
            if (!nextNode || !nextNode.routes) return data;
            const routes = [...nextNode.routes];
            if (!routes[routeIdx]) return data;
            routes[routeIdx] = { ...routes[routeIdx], goto: "", gotoId: "" };
            return { ...data, nextNode: { ...nextNode, routes } };
          });
        }
        return;
      }

      if (sourceNode.type === "start") {
        updateNodeDataLocal(sourceNode.id, (data) => ({
          ...data,
          entryNode: "",
        }));
      }
    });

    const nextNodes = state.nodes.map((n) => nodeMap.get(n.id) || n);
    const nextEdges = state.edges.filter((e) => !edgeIdsToRemove.has(e.id));

    return {
      nodes: nextNodes,
      edges: nextEdges,
      flow: buildFlowJson(nextNodes, nextEdges),
      modifiedGroupIds: nextModifiedGroupIds,
    };
  }),

setSelectedNodeId: (id) => set({ selectedNodeId: id }),

openInspector: (id) => {
  try {
    const node = get().nodes.find((n) => n.id === id);
    const isLarge =
      node?.type === "action" ||
      node?.type === "prompt" ||
      node?.type === "condition" ||
      node?.type === "router" ||
      node?.type === "script" ||
      node?.type === "functionCall";

    const el = document.querySelector(
      `.react-flow__node[data-id="${id}"]`
    ) as HTMLElement | null;

    let pos: {
      x: number;
      y: number;
      placement: "above" | "below" | "center";
    } | null = null;
    if (el) {
      const rect = el.getBoundingClientRect();
      const modalWidth = isLarge ? 720 : 350;
      const modalHalf = modalWidth / 2;
      const modalHeightEstimate = isLarge ? 500 : 320;
      const xCenter = rect.left + rect.width / 2;
      const x = Math.min(
        Math.max(xCenter, modalHalf + 16),
        window.innerWidth - modalHalf - 16
      );
      const margin = 12;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceAbove > modalHeightEstimate + margin) {
        pos = { x, y: rect.top - margin, placement: "above" };
      } else if (spaceBelow > modalHeightEstimate + margin) {
        pos = { x, y: rect.bottom + margin, placement: "below" };
      } else {
        pos = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          placement: "center",
        };
      }
    }

    set({
      inspectorOpen: true,
      selectedNodeId: id,
      inspectorPosition: pos,
    });
  } catch {
    set({
      inspectorOpen: true,
      selectedNodeId: id,
      inspectorPosition: null,
    });
  }
},

closeInspector: () =>
  set({ inspectorOpen: false, inspectorPosition: null }),

setInspectorPosition: (pos) => set({ inspectorPosition: pos }),

updateNodeData: (id, data: Partial<Record<string, unknown>>) =>
  set((state) => {
    let nextNodes = state.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );

    // Identify if this node belongs to a published flow
    let groupIdToMark: string | null = null;
    const node = state.nodes.find(n => n.id === id);
    if (node?.parentNode) {
      const info = getParentGroupInfo(state.nodes, node.id);
      if (info && state.publishedGroupIds.includes(info.groupId)) {
        groupIdToMark = info.groupId;
      }
    }

    const renameTargets: Array<{ targetId: string; oldName: string; newName: string }> = [];
    const addRenameTarget = (
      targetId: string | null | undefined,
      oldNameRaw: unknown,
      newNameRaw: unknown
    ) => {
      if (!targetId) return;
      const oldName = String(oldNameRaw ?? "").trim();
      const newName = String(newNameRaw ?? "").trim();
      if (!oldName || !newName || oldName === newName) return;
      renameTargets.push({ targetId, oldName, newName });
    };

    if (node?.type === "start" && data.flowName !== undefined) {
      const nodeData = (node.data as Record<string, unknown>) || {};
      addRenameTarget(node.parentNode, nodeData.flowName, data.flowName);
    } else if (data.name !== undefined) {
      const nodeData = ((node?.data as Record<string, unknown>) || {});
      addRenameTarget(node?.id, nodeData.name, data.name);
    }

    if (renameTargets.length > 0) {
      nextNodes = nextNodes.map((n) => {
        if (n.type !== "script") return n;
        const scriptData = (n.data as Record<string, unknown>) || {};
        const routes = Array.isArray(scriptData.routes)
          ? (scriptData.routes as Array<{ nextNodeId?: string }>)
          : [];
        if (routes.length === 0) return n;

        let updatedScript = String(scriptData.script ?? "");
        let changed = false;
        renameTargets.forEach((rename) => {
          const isConnected = routes.some(
            (route) => route?.nextNodeId === rename.targetId
          );
          if (!isConnected) return;
          const nextScript = replaceNextNodeNameInScript(
            updatedScript,
            rename.oldName,
            rename.newName
          );
          if (nextScript !== updatedScript) {
            updatedScript = nextScript;
            changed = true;
          }
        });

        if (!changed) return n;
        return { ...n, data: { ...n.data, script: updatedScript } };
      });
    }

    // PROPAGATION LOGIC: Sync names from PromptNode routes to connected Menu Branch Groups
    const targetNode = nextNodes.find((n) => n.id === id);
    if (!targetNode) return state;

    // SYNC LOGIC: Bi-directional name sync between Group and Start node
    if (targetNode.type === "start" && data.flowName !== undefined) {
      if (targetNode.parentNode) {
        nextNodes = nextNodes.map((n) =>
          n.id === targetNode.parentNode ? { ...n, data: { ...n.data, name: String(data.flowName) } } : n
        );
      }
    } else if (targetNode.type === "group" && data.name !== undefined) {
      nextNodes = nextNodes.map((n) =>
        n.parentNode === targetNode.id && n.type === "start"
          ? { ...n, data: { ...n.data, flowName: String(data.name) } }
          : n
      );
    }

    // PROPAGATION LOGIC: Sync names from PromptNode routes to connected Menu Branch Groups
    if (targetNode.type === "prompt" && data.nextNode) {
      const nextNode = data.nextNode as FlowNode["nextNode"];
      if (typeof nextNode === "object" && nextNode && "routes" in nextNode) {
        const routes = nextNode.routes || [];

        // For each route, check if it's connected to a Menu Branch Group
        routes.forEach((route, idx) => {
          const handleId = `route-${idx}`;
          const edge = state.edges.find(
            (e) => e.source === id && e.sourceHandle === handleId
          );

          if (edge) {
            const connectedNode = nextNodes.find(
              (n) => n.id === edge.target
            );
            if (
              connectedNode &&
              connectedNode.type === "group" &&
              connectedNode.data.isMenuBranch
            ) {
              const when = route.when as { eq?: string[] } | undefined;
              const newName =
                route.gotoFlow || when?.eq?.[1] || "Branch";

              // Update Group Name in the nextNodes array
              nextNodes = nextNodes.map((n) => {
                if (n.id === connectedNode.id) {
                  return { ...n, data: { ...n.data, name: newName } };
                }
                // Also update the internal Start Node's flowName
                if (
                  n.parentNode === connectedNode.id &&
                  n.type === "start"
                ) {
                  return { ...n, data: { ...n.data, flowName: newName } };
                }
                return n;
              });
            } else if (connectedNode && connectedNode.type !== "group") {
              // NEW: Sync name for non-group nodes
              const when = route.when as { eq?: string[] } | undefined;
              const newName = route.gotoFlow || when?.eq?.[1];

              if (!newName) {
                toast.error("Invalid Branch", {
                  description: "Please define a name in the branch.",
                  duration: 4000
                });
                return;
              }

              nextNodes = nextNodes.map((n) => {
                if (n.id === connectedNode.id) {
                  return { ...n, data: { ...n.data, name: newName } };
                }
                return n;
              });
            }
          }
        });
      }
    }

    let nextModifiedGroupIds = state.modifiedGroupIds;
    const nextModifiedGroupsLog = { ...state.modifiedGroupsLog };

    if (groupIdToMark) {
      const currentSnapshot = calculateFlowSnapshot(groupIdToMark, nextNodes, state.edges);
      const originalSnapshot = state.lastSyncedSnapshots[groupIdToMark];
      const isActuallyModified = currentSnapshot !== originalSnapshot;

      if (isActuallyModified) {
        if (!nextModifiedGroupIds.includes(groupIdToMark)) {
          nextModifiedGroupIds = [...nextModifiedGroupIds, groupIdToMark];
        }
        const groupLog = nextModifiedGroupsLog[groupIdToMark] || [];
        const nodeName = targetNode.data?.name || targetNode.data?.flowName || targetNode.type;

        // Diff Helper: Compare against original snapshot if available
        let originalNodeData: Record<string, unknown> = {};
        try {
          const originalSnapshotStr = state.lastSyncedSnapshots[groupIdToMark];
          if (originalSnapshotStr) {
            const originalSnapshot = JSON.parse(originalSnapshotStr) as {
              nodes?: Array<{ id?: string; data?: Record<string, unknown> }>;
            };
            const originalNode = (originalSnapshot.nodes || []).find(
              (n) => n.id === targetNode.id
            );
            if (originalNode?.data) originalNodeData = originalNode.data;
          }
        } catch { }

        const tr = (v: unknown) => {
          const s = typeof v === 'string' ? v : JSON.stringify(v);
          return s.length > 25 ? s.substring(0, 25) + "..." : s;
        };

        Object.entries(data).forEach(([key, newValue]) => {
          const oldValue = originalNodeData[key];
          if (oldValue !== newValue) {
            const diffText = oldValue !== undefined ? `"${tr(oldValue)}" → "${tr(newValue)}"` : `"${tr(newValue)}"`;
            const logPrefix = `Updated ${targetNode.type} node "${nodeName}" (${key})`;
            const newEntry = `${logPrefix}: ${diffText}`;

            const existingIdx = groupLog.findIndex(l => l.startsWith(logPrefix));
            if (existingIdx !== -1) {
              groupLog[existingIdx] = newEntry;
            } else {
              groupLog.push(newEntry);
            }
          }
        });

        nextModifiedGroupsLog[groupIdToMark] = [...groupLog];
      } else {
        nextModifiedGroupIds = nextModifiedGroupIds.filter(id => id !== groupIdToMark);
        nextModifiedGroupsLog[groupIdToMark] = [];
      }
    }

    return {
      nodes: nextNodes,
      flow: buildFlowJson(nextNodes, state.edges),
      modifiedGroupIds: nextModifiedGroupIds,
      modifiedGroupsLog: nextModifiedGroupsLog,
    };
  }),

isNameTaken: (name, excludeId) => {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;

  const { nodes, currentSubflowId } = get();

  // Find the parent group of the node we're checking
  const targetNode = excludeId
    ? nodes.find((n) => n.id === excludeId)
    : null;
  const parentId = targetNode ? targetNode.parentNode : currentSubflowId;

  return nodes.some(
    (n) =>
      n.id !== excludeId &&
      n.parentNode === parentId && // Must be in the same group
      n.type !== "group" && // Skip group nodes (as requested: group node can have any name)
      // Check both standard 'name' and Start node's 'flowName'
      (String((n.data as Record<string, unknown>)?.name ?? "")
        .trim()
        .toLowerCase() === trimmed ||
        String((n.data as Record<string, unknown>)?.flowName ?? "")
          .trim()
          .toLowerCase() === trimmed)
  );
},
});
