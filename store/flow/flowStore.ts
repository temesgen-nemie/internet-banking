import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Node, Edge, ReactFlowInstance } from "reactflow";
import type { FlowJson } from "./types";
import { createRemoteFlowActions } from "./actions/remoteActions";
import { createClipboardActions } from "./actions/clipboardActions";
import { createGraphActions } from "./actions/graphActions";
import { createStructureActions } from "./actions/structureActions";

export type { FlowJson, FlowNode, FlowRoute } from "./types";

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  flow: FlowJson;
  selectedNodeId: string | null;
  inspectorOpen: boolean;
  inspectorPosition: {
    x: number;
    y: number;
    placement: "above" | "below" | "center";
  } | null;

  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  removeEdges: (ids: string[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  openInspector: (id: string) => void;
  closeInspector: () => void;
  setInspectorPosition: (
    pos: {
      x: number;
      y: number;
      placement: "above" | "below" | "center";
    } | null
  ) => void;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  isNameTaken: (name: string, excludeId?: string) => boolean;

  // Subflow / Grouping State
  currentSubflowId: string | null;
  enterSubflow: (groupId: string) => void;
  exitSubflow: (targetId?: string | null) => void;
  groupNodes: (nodeIds: string[], name: string) => void;
  ungroupNodes: (groupId: string) => void;

  // Modal State
  namerModal: { isOpen: boolean; nodeIds: string[] } | null;
  openNamer: (nodeIds: string[]) => void;
  closeNamer: () => void;

  groupJsonModal: {
    isOpen: boolean;
    groupId: string | null;
    json: string;
  } | null;
  openGroupJson: (groupId: string) => void;
  closeGroupJson: () => void;
  applyGroupJson: (groupId: string, jsonText: string) => void;

  rfInstance: ReactFlowInstance | null;
  setRfInstance: (instance: ReactFlowInstance) => void;

  publishGroup: (groupId: string) => Promise<void>;

  loadAllFlows: () => Promise<void>;
  refreshFlow: (flowName: string, groupId: string) => Promise<void>;
  deletePublishedFlow: (flowName: string) => Promise<void>;
  syncNodeWithBackend: (nodeId: string, previousName?: string) => Promise<void>;
  isLoading: boolean;
  publishedGroupIds: string[];
  clipboard: Node[] | null;
  copyNodes: (nodeIds: string[]) => void;
  pasteNodes: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  modifiedGroupIds: string[];
  modifiedGroupsLog: Record<string, string[]>;
  lastSyncedSnapshots: Record<string, string>;
  updatePublishedFlow: (groupId: string) => Promise<void>;
  getRecursiveSubflowJson: (groupId: string) => string;
  importSubflow: (jsonText: string, position?: { x: number; y: number }) => void;

  // Refresh Confirmation Modal
  refreshConfirmModal: {
    isOpen: boolean;
    type: "global" | "group";
    flowName?: string;
    groupId?: string;
  };
  openRefreshConfirm: (type: "global" | "group", flowName?: string, groupId?: string) => void;
  closeRefreshConfirm: () => void;
  resolveTargetId: (id: string) => { id: string; name: string };
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      flow: {
        flowName: "",
        entryNode: "",
        entryNodeId: "",
        nodes: [],
      },
      selectedNodeId: null,
      inspectorOpen: false,
      inspectorPosition: null,

      currentSubflowId: null,
      namerModal: null,
      groupJsonModal: null,
      isLoading: false,
      publishedGroupIds: [],
      modifiedGroupIds: [],
      modifiedGroupsLog: {},
      lastSyncedSnapshots: {},
      clipboard: null,
      _hasHydrated: false,

      refreshConfirmModal: {
        isOpen: false,
        type: "global",
      },
      openRefreshConfirm: (type, flowName, groupId) => set({
        refreshConfirmModal: { isOpen: true, type, flowName, groupId }
      }),
      closeRefreshConfirm: () => set({
        refreshConfirmModal: { isOpen: false, type: "global" }
      }),
      resolveTargetId: (id: string) => {
        const { nodes } = get();
        if (!id) return { id: "", name: "" };

        let currentId = id;

        // Initial lookup: If not found as ID, maybe it's a Name
        const nodeById = nodes.find(n => n.id === currentId);
        if (!nodeById) {
          const nodeByName = nodes.find(n => n.data?.name === currentId);
          if (nodeByName) {
            currentId = nodeByName.id;
          }
        }

        const finalNode = nodes.find(n => n.id === currentId);
        return {
          id: currentId,
          name: finalNode?.data?.name || (finalNode?.type === "start" ? "Flow Entry" : "") || ""
        };
      },

      ...createRemoteFlowActions({ set, get }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
      ...createClipboardActions({ set, get }),
      ...createGraphActions({ set, get }),
      ...createStructureActions({ set, get }),
    }),
    {
      name: "ussd-menu-builder",
      storage: createJSONStorage(() => localStorage),
      // Update hydration to strip parentNode if needed (safety check from previous revert)
      onRehydrateStorage: () => {
        return (rehydratedState, error) => {
          if (error || !rehydratedState) return;

          // Safety Check: Ensure modifiedGroupIds is an array
          if (!Array.isArray(rehydratedState.modifiedGroupIds)) {
            rehydratedState.modifiedGroupIds = [];
          }
          if (!Array.isArray(rehydratedState.publishedGroupIds)) {
            rehydratedState.publishedGroupIds = [];
          }
          if (Array.isArray(rehydratedState.nodes)) {
            rehydratedState.nodes = rehydratedState.nodes.map((node) => {
              if (node.type !== "prompt") return node;
              const data = { ...((node.data as Record<string, unknown>) || {}) };
              delete data.routingMode;
              delete data.pagination;
              delete data.hasMultiplePage;
              delete data.indexPerPage;
              return { ...node, data };
            });
          }

          rehydratedState.setHasHydrated(true);
        };
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        flow: state.flow,
        publishedGroupIds: state.publishedGroupIds,
        modifiedGroupIds: state.modifiedGroupIds,
      }),
    }
  )
);
