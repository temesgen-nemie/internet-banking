import { type Edge, type Node, type ReactFlowInstance } from "reactflow";
import { v4 as uuidv4 } from "uuid";

import { buildFlowJson, getNamespacedGroupFlowName } from "@/store/flow/serialization";
import type { FlowJson } from "@/store/flow/types";

type GroupJsonModalState = {
  isOpen: boolean;
  groupId: string | null;
  json: string;
};

type NodeJsonModalState = {
  isOpen: boolean;
  nodeId: string | null;
};

type NamerModalState = {
  isOpen: boolean;
  nodeIds: string[];
};

type StructureActionsState = {
  nodes: Node[];
  edges: Edge[];
  flow: FlowJson;
  currentSubflowId: string | null;
  inspectorOpen: boolean;
  rfInstance: ReactFlowInstance | null;
  selectedNodeId: string | null;
  namerModal: NamerModalState | null;
  groupJsonModal: GroupJsonModalState | null;
  nodeJsonModal: NodeJsonModalState | null;
};

type StoreSet = (
  partial:
    | Partial<StructureActionsState>
    | ((state: StructureActionsState) => Partial<StructureActionsState>)
) => unknown;
type StoreGet = () => StructureActionsState;

type StructureActions = {
  enterSubflow: (groupId: string) => void;
  exitSubflow: (targetId?: string | null) => void;
  groupNodes: (nodeIds: string[], name: string) => void;
  ungroupNodes: (groupId: string) => void;
  openNamer: (nodeIds: string[]) => void;
  closeNamer: () => void;
  openGroupJson: (groupId: string) => void;
  closeGroupJson: () => void;
  applyGroupJson: (groupId: string, jsonText: string) => void;
  openNodeJson: (nodeId: string) => void;
  closeNodeJson: () => void;
};

export const createStructureActions = ({
  set,
  get,
}: {
  set: StoreSet;
  get: StoreGet;
}): StructureActions => ({
  enterSubflow: (groupId) => set({ currentSubflowId: groupId, inspectorOpen: false }),
  exitSubflow: (targetId) => {
    if (targetId !== undefined) {
      set({ currentSubflowId: targetId, inspectorOpen: false });
      return;
    }

    // Default behavior: go up one level
    const { nodes, currentSubflowId } = get();
    if (!currentSubflowId) return;

    const currentGroup = nodes.find((n) => n.id === currentSubflowId);
    const parentId = currentGroup?.parentNode || null;
    set({ currentSubflowId: parentId, inspectorOpen: false });
  },

  groupNodes: (nodeIds, name) => {
    const { nodes, rfInstance, edges } = get();

    // Handle Empty Group creation
    if (nodeIds.length === 0) {
      const groupId = `group-${Date.now()}`;

      // Get sensible default position
      let pos = { x: 100, y: 100 };
      if (rfInstance) {
        const center = rfInstance.project({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        pos = center;
      }

      const newNode: Node = {
        id: groupId,
        type: "group",
        position: pos,
        data: { name: name || "Empty Group" },
        parentNode: get().currentSubflowId || undefined,
      };

      // Automatically add a Start node inside the empty group
      const groupName = String(newNode.data.name ?? "");
      const startNode: Node = {
        id: uuidv4(),
        type: "start",
        position: { x: 50, y: 50 },
        data: {
          flowName: getNamespacedGroupFlowName(nodes, groupId, groupName),
          entryNode: "",
        },
        parentNode: groupId,
        extent: "parent",
      };

      const nextNodes = [...nodes, newNode, startNode];
      set({
        nodes: nextNodes,
        flow: buildFlowJson(nextNodes, edges),
        selectedNodeId: groupId,
      });
      return;
    }

    const selectedNodes = nodes.filter((n) => nodeIds.includes(n.id));
    if (selectedNodes.length < 1) return; // Should not happen with current UI logic

    // Calculate center for the group node
    const avgX = selectedNodes.reduce((acc, n) => acc + n.position.x, 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((acc, n) => acc + n.position.y, 0) / selectedNodes.length;

    const groupId = `group-${Date.now()}`;
    const newNode: Node = {
      id: groupId,
      type: "group",
      position: { x: avgX, y: avgY },
      data: { name: name || "New Group" },
      parentNode: get().currentSubflowId || undefined,
    };

    const updatedNodes = nodes.map((n) => {
      if (nodeIds.includes(n.id)) {
        return {
          ...n,
          position: { x: n.position.x - avgX, y: n.position.y - avgY },
          parentNode: groupId,
          extent: "parent" as const,
        };
      }
      return n;
    });

    const nextNodes = [...updatedNodes, newNode];

    // Automatically handle Start node inside the new group
    const existingStart = selectedNodes.find((n) => n.type === "start");
    if (existingStart) {
      const groupName = String(newNode.data.name ?? "");
      const namespacedFlowName = getNamespacedGroupFlowName(nextNodes, groupId, groupName);
      // Update its name to match the group
      const finalNodes = nextNodes.map((n) =>
        n.id === existingStart.id
          ? { ...n, data: { ...n.data, flowName: namespacedFlowName } }
          : n
      );
      set({
        nodes: finalNodes,
        flow: buildFlowJson(finalNodes, edges),
        selectedNodeId: groupId,
      });
    } else {
      // Create a new Start node inside
      const groupName = String(newNode.data.name ?? "");
      const startNode: Node = {
        id: uuidv4(),
        type: "start",
        position: { x: 50, y: 50 },
        data: {
          flowName: getNamespacedGroupFlowName(nextNodes, groupId, groupName),
          entryNode: "",
        },
        parentNode: groupId,
        extent: "parent",
      };
      const finalNodes = [...nextNodes, startNode];
      set({
        nodes: finalNodes,
        flow: buildFlowJson(finalNodes, edges),
        selectedNodeId: groupId,
      });
    }
  },

  ungroupNodes: (groupId) => {
    const { nodes } = get();
    const groupNode = nodes.find((n) => n.id === groupId);
    if (!groupNode) return;

    const nextNodes = nodes
      .filter((n) => n.id !== groupId)
      .map((n) => {
        if (n.parentNode === groupId) {
          return {
            ...n,
            position: {
              x: n.position.x + groupNode.position.x,
              y: n.position.y + groupNode.position.y,
            },
            parentNode: undefined,
            extent: undefined,
          };
        }
        return n;
      });

    set((state) => ({
      nodes: nextNodes,
      flow: buildFlowJson(nextNodes, state.edges),
      selectedNodeId: null,
    }));
  },

  openNamer: (nodeIds) => set({ namerModal: { isOpen: true, nodeIds } }),
  closeNamer: () => set({ namerModal: null }),

  openGroupJson: (groupId) => {
    const { nodes, edges } = get();
    const children = nodes.filter((n) => n.parentNode === groupId);
    const childIds = children.map((n) => n.id);
    const relevantEdges = edges.filter(
      (e) => childIds.includes(e.source) && childIds.includes(e.target)
    );
    const subflowJson = buildFlowJson(children, relevantEdges);
    set({
      groupJsonModal: {
        isOpen: true,
        groupId,
        json: JSON.stringify(subflowJson, null, 2),
      },
    });
  },
  closeGroupJson: () => set({ groupJsonModal: null }),
  openNodeJson: (nodeId) => set({ nodeJsonModal: { isOpen: true, nodeId } }),
  closeNodeJson: () => set({ nodeJsonModal: null }),
  applyGroupJson: (groupId, jsonText) => {
    if (!groupId) {
      throw new Error("Missing group id.");
    }

    let parsed: FlowJson;
    try {
      parsed = JSON.parse(jsonText) as FlowJson;
    } catch {
      throw new Error("Invalid JSON.");
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.visualState ||
      !Array.isArray(parsed.visualState.nodes) ||
      !Array.isArray(parsed.visualState.edges)
    ) {
      throw new Error("JSON must include visualState with nodes and edges.");
    }

    const incomingNodes = parsed.visualState.nodes as Node[];
    const incomingEdges = parsed.visualState.edges as Edge[];
    const incomingIds = new Set(incomingNodes.map((n) => n.id));

    const normalizedNodes = incomingNodes.map((n) => {
      let parentNode = n.parentNode;
      if (!parentNode || !incomingIds.has(parentNode)) {
        parentNode = groupId;
      }
      return {
        ...n,
        parentNode,
        extent: parentNode ? ("parent" as const) : undefined,
      };
    });

    const normalizedIds = new Set(normalizedNodes.map((n) => n.id));
    const normalizedEdges = incomingEdges.filter(
      (e) => normalizedIds.has(e.source) && normalizedIds.has(e.target)
    );

    const flowNodesById = new Map(parsed.nodes.map((node) => [node.id, node]));

    const applyFlowNodeData = (node: Node): Node => {
      if (node.type === "start") {
        const startData = (node.data as Record<string, unknown>) || {};
        return {
          ...node,
          data: {
            ...startData,
            flowName: parsed.flowName ?? startData.flowName,
            entryNode: parsed.entryNode || startData.entryNode,
            entryNodeId: parsed.entryNodeId || startData.entryNodeId,
          },
        };
      }

      const flowNode = flowNodesById.get(node.id);
      if (!flowNode) return node;

      const nextData = { ...(node.data as Record<string, unknown>) };
      nextData.name = flowNode.name ?? nextData.name;

      if (node.type === "prompt") {
        nextData.message = flowNode.message ?? nextData.message;
        nextData.responseFormat = flowNode.responseFormat ?? nextData.responseFormat;
        nextData.responseBodyMapping = flowNode.responseBodyMapping ?? nextData.responseBodyMapping;
        nextData.responseBodyRaw = flowNode.responseBodyRaw ?? nextData.responseBodyRaw;
        nextData.responseStatusCode =
          typeof flowNode.responseStatusCode === "number"
            ? flowNode.responseStatusCode
            : nextData.responseStatusCode;
        nextData.persistByIndex =
          typeof flowNode.persistByIndex === "boolean"
            ? flowNode.persistByIndex
            : nextData.persistByIndex;
        nextData.persistByIndexValue = flowNode.persistByIndexValue ?? nextData.persistByIndexValue;
        nextData.persistSourceField = flowNode.persistSourceField ?? nextData.persistSourceField;
        nextData.persistFieldName = flowNode.persistFieldName ?? nextData.persistFieldName;
        nextData.validateIndexedList =
          typeof flowNode.validateIndexedList === "boolean"
            ? flowNode.validateIndexedList
            : nextData.validateIndexedList;
        nextData.indexedListVar = flowNode.indexedListVar ?? nextData.indexedListVar;
        nextData.invalidInputMessage = flowNode.invalidInputMessage ?? nextData.invalidInputMessage;
        nextData.emptyInputMessage = flowNode.emptyInputMessage ?? nextData.emptyInputMessage;
        nextData.inputType = flowNode.inputType ?? nextData.inputType;
        nextData.invalidInputTypeMessage =
          flowNode.invalidInputTypeMessage ?? nextData.invalidInputTypeMessage;
        nextData.inputValidationEnabled =
          typeof flowNode.inputValidationEnabled === "boolean"
            ? flowNode.inputValidationEnabled
            : nextData.inputValidationEnabled;
        nextData.encryptInput =
          typeof flowNode.encryptInput === "boolean"
            ? flowNode.encryptInput
            : nextData.encryptInput;

        if (
          flowNode.nextNode &&
          typeof flowNode.nextNode === "object" &&
          flowNode.nextNode.routes
        ) {
          const routes = flowNode.nextNode.routes.map((route) => ({
            when: route.when,
            goto: route.gotoId || route.goto || "",
            gotoFlow: route.gotoFlow || "",
            gotoId: route.gotoId || route.goto || "",
            isGoBack: route.isGoBack,
            toMainMenu: route.toMainMenu,
            goBackTarget: route.goBackTargetId || route.goBackTarget || "",
            goBackTargetId: route.goBackTargetId || route.goBackTarget || "",
            goBackToFlow: route.goBackToFlow,
          }));
          nextData.nextNode = {
            routes,
            default: flowNode.nextNode.default || "",
            defaultId: flowNode.nextNode.defaultId || "",
          };
        } else if (typeof flowNode.nextNode === "string") {
          nextData.nextNode = flowNode.nextNode;
        }

        return { ...node, data: nextData };
      }

      if (node.type === "router") {
        nextData.url = flowNode.url ?? nextData.url;
        nextData.method = flowNode.method ?? nextData.method;
        nextData.sessionMode = flowNode.sessionMode ?? nextData.sessionMode;
        nextData.extractUrlPathSegment =
          typeof flowNode.extractUrlPathSegment === "boolean"
            ? flowNode.extractUrlPathSegment
            : nextData.extractUrlPathSegment;
        nextData.responseMapping = flowNode.responseMapping ?? nextData.responseMapping;

        if (typeof flowNode.nextNode === "string") {
          nextData.nextNode = {
            routes: [],
            default: flowNode.nextNode,
            defaultId: flowNode.nextNode,
          };
        } else if (flowNode.nextNode && typeof flowNode.nextNode === "object") {
          nextData.nextNode = {
            routes: (flowNode.nextNode.routes || []).map((route) => ({
              when: route.when,
              goto: route.gotoId || route.goto || route.gotoFlow || "",
              gotoId: route.gotoId || route.goto || route.gotoFlow || "",
              toMainMenu: route.toMainMenu,
              isGoBack: route.isGoBack,
              goBackTarget: route.goBackTargetId || route.goBackTarget || "",
              goBackTargetId: route.goBackTargetId || route.goBackTarget || "",
              goBackToFlow: route.goBackToFlow,
            })),
            default: flowNode.nextNode.default || flowNode.nextNode.defaultId || "",
            defaultId: flowNode.nextNode.defaultId || flowNode.nextNode.default || "",
          };
        }

        return { ...node, data: nextData };
      }

      if (node.type === "action") {
        nextData.requestSource = flowNode.requestSource ?? nextData.requestSource;
        nextData.endpoint = flowNode.endpoint ?? nextData.endpoint;
        nextData.method = flowNode.method ?? nextData.method;
        nextData.curl = flowNode.curl ?? nextData.curl;
        nextData.wsCurl = flowNode.wsCurl ?? nextData.wsCurl;
        nextData.wsUrl = flowNode.wsUrl ?? nextData.wsUrl;
        nextData.wsProtocols = flowNode.wsProtocols ?? nextData.wsProtocols;
        nextData.wsMessage = flowNode.wsMessage ?? nextData.wsMessage;
        nextData.wsLastMessage = flowNode.wsLastMessage ?? nextData.wsLastMessage;
        nextData.dataSource = flowNode.dataSource ?? nextData.dataSource;
        const flowFields = Array.isArray(flowNode.fields)
          ? flowNode.fields
          : flowNode.field
            ? [flowNode.field]
            : undefined;
        const flowOutputVars = Array.isArray(flowNode.outputVars)
          ? flowNode.outputVars
          : flowNode.outputVar
            ? [flowNode.outputVar]
            : undefined;
        nextData.fields = flowFields ?? nextData.fields;
        nextData.outputVars = flowOutputVars ?? nextData.outputVars;
        nextData.field = flowFields?.[0] ?? nextData.field;
        nextData.outputVar = flowOutputVars?.[0] ?? nextData.outputVar;
        nextData.format = flowNode.format ?? nextData.format;
        nextData.headers = flowNode.headers ?? nextData.headers;
        nextData.apiBody = flowNode.apiBody ?? nextData.apiBody;
        nextData.apiBodyRaw = flowNode.apiBodyRaw ?? nextData.apiBodyRaw;
        nextData.bodyMode = flowNode.bodyMode ?? nextData.bodyMode;
        nextData.responseMapping = flowNode.responseMapping ?? nextData.responseMapping;
        nextData.persistResponseMapping =
          typeof flowNode.persistResponseMapping === "boolean"
            ? flowNode.persistResponseMapping
            : nextData.persistResponseMapping;

        if (
          flowNode.nextNode &&
          typeof flowNode.nextNode === "object" &&
          flowNode.nextNode.routes
        ) {
          const routes = flowNode.nextNode.routes.map((route) => ({
            id: uuidv4(),
            condition: route.when ? JSON.stringify(route.when) : "",
            nextNodeId: route.gotoId || route.goto || route.gotoFlow || "",
          }));
          nextData.routes = routes;

          nextData.nextNode = flowNode.nextNode.defaultId || flowNode.nextNode.default || "";
        } else if (typeof flowNode.nextNode === "string") {
          nextData.nextNode = flowNode.nextNode;
        }

        return { ...node, data: nextData };
      }

      if (node.type === "functionCall") {
        nextData.functionName = flowNode.functionName ?? nextData.functionName;
        nextData.args = flowNode.args ?? nextData.args;
        nextData.saveAs = flowNode.saveAs ?? nextData.saveAs;
        nextData.nextNode = flowNode.nextNode ?? nextData.nextNode;
        return { ...node, data: nextData };
      }

      if (node.type === "script") {
        nextData.script = flowNode.script ?? nextData.script;
        nextData.timeoutMs = typeof flowNode.timeoutMs === "number" ? flowNode.timeoutMs : 25;
        nextData.nextNode = flowNode.nextNode ?? nextData.nextNode;
        if (Array.isArray(flowNode.scriptRoutes)) {
          nextData.routes = flowNode.scriptRoutes.map((route) => ({
            id: uuidv4(),
            key: route.key ?? "",
            nextNodeId: route.gotoId || route.goto || "",
          }));
        }
        return { ...node, data: nextData };
      }

      return { ...node, data: nextData };
    };

    const normalizedNodesWithData = normalizedNodes.map(applyFlowNodeData);

    const { nodes: currentNodes, edges: currentEdges, groupJsonModal } = get();
    const nodesToRemoveIds = new Set<string>();
    currentNodes.forEach((n) => {
      if (n.parentNode === groupId) nodesToRemoveIds.add(n.id);
    });

    let changed = true;
    while (changed) {
      changed = false;
      currentNodes.forEach((n) => {
        if (n.parentNode && nodesToRemoveIds.has(n.parentNode)) {
          if (!nodesToRemoveIds.has(n.id)) {
            nodesToRemoveIds.add(n.id);
            changed = true;
          }
        }
      });
    }

    const remainingNodes = currentNodes.filter((n) => !nodesToRemoveIds.has(n.id));
    const remainingEdges = currentEdges.filter(
      (e) => !nodesToRemoveIds.has(e.source) && !nodesToRemoveIds.has(e.target)
    );

    const remainingNodeIds = new Set(remainingNodes.map((n) => n.id));
    normalizedNodesWithData.forEach((node) => {
      if (remainingNodeIds.has(node.id)) {
        throw new Error(`Node id conflict: ${node.id}`);
      }
    });

    const remainingEdgeIds = new Set(remainingEdges.map((e) => e.id));
    normalizedEdges.forEach((e) => {
      if (remainingEdgeIds.has(e.id)) {
        throw new Error(`Edge id conflict: ${e.id}`);
      }
    });

    const nextNodes = [...remainingNodes, ...normalizedNodesWithData];
    const nextEdges = [...remainingEdges, ...normalizedEdges];
    const normalizedJson = JSON.stringify(
      {
        ...parsed,
        visualState: { nodes: normalizedNodesWithData, edges: normalizedEdges },
      },
      null,
      2
    );

    set({
      nodes: nextNodes,
      edges: nextEdges,
      flow: buildFlowJson(nextNodes, nextEdges),
      groupJsonModal:
        groupJsonModal && groupJsonModal.groupId === groupId
          ? { ...groupJsonModal, json: normalizedJson }
          : groupJsonModal,
    });
  },
});
