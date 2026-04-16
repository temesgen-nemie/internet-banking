import { type Edge, type Node } from "reactflow";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { createFlow } from "@/lib/api";
import {
  buildFlowJson,
  calculateFlowSnapshot,
  getFlowLeafName,
  getNamespacedGroupFlowName,
} from "@/store/flow/serialization";
import type { FlowJson, FlowNode } from "@/store/flow/types";

type StoreSet = (...args: any[]) => unknown;
type StoreGet = () => Record<string, any>;

const getVisualStateArrays = (flow?: FlowJson) => {
  const visualState = flow?.visualState;
  const nodes = Array.isArray(visualState?.nodes) ? visualState.nodes : [];
  const edges = Array.isArray(visualState?.edges) ? visualState.edges : [];
  return { nodes, edges };
};

const collectGroupSubtree = (groupId: string, nodes: Node[], edges: Edge[]) => {
  const descendants: Node[] = [];

  const visit = (parentId: string) => {
    const children = nodes.filter((node: Node) => node.parentNode === parentId);
    for (const child of children) {
      descendants.push(child);
      if (child.type === "group") {
        visit(child.id);
      }
    }
  };

  visit(groupId);

  const groupNode = nodes.find((node: Node) => node.id === groupId);
  const nodesToSave = groupNode ? [groupNode, ...descendants] : descendants;
  const nodeIds = new Set(nodesToSave.map((node) => node.id));
  const relevantEdges = edges.filter(
    (edge: Edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return { nodesToSave, relevantEdges };
};

const normalizeGroupFlowNameForPublish = (
  groupId: string,
  nodesToSave: Node[],
  allNodes: Node[]
): Node[] => {
  const groupNode = allNodes.find((node) => node.id === groupId);
  if (!groupNode) {
    return nodesToSave;
  }

  const currentName = String((groupNode.data as Record<string, unknown>)?.name ?? "");
  const namespacedFlowName = getNamespacedGroupFlowName(allNodes, groupId, currentName);
  if (!namespacedFlowName) {
    return nodesToSave;
  }

  return nodesToSave.map((node) => {
    if (node.id === groupId) {
      return {
        ...node,
        data: {
          ...(node.data as Record<string, unknown>),
          name: getFlowLeafName(currentName || namespacedFlowName),
        },
      };
    }

    if (node.parentNode === groupId && node.type === "start") {
      return {
        ...node,
        data: {
          ...(node.data as Record<string, unknown>),
          flowName: namespacedFlowName,
        },
      };
    }

    return node;
  });
};

export const createRemoteFlowActions = ({
  set,
  get,
}: {
  set: StoreSet;
  get: StoreGet;
}) => ({
  updatePublishedFlow: async (groupId: string) => {
    const { nodes, edges, modifiedGroupIds } = get();
    const { nodesToSave: rawNodesToSave, relevantEdges } = collectGroupSubtree(groupId, nodes, edges);
    const nodesToSave = normalizeGroupFlowNameForPublish(groupId, rawNodesToSave, nodes);
    const subflowJson = buildFlowJson(nodesToSave, relevantEdges);
    const flowName = subflowJson.flowName;

    if (!flowName) {
      toast.error("Flow name not found. Cannot update.");
      return;
    }

    try {
      const { updateFlow } = await import("@/lib/api");
      toast.promise(updateFlow(flowName, subflowJson), {
        loading: `Updating flow '${flowName}'...`,
        success: () => {
          set({
            modifiedGroupIds: modifiedGroupIds.filter((id: string) => id !== groupId),
          });
          return `Flow '${flowName}' updated successfully!`;
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error";
          return `Failed to update: ${message}`;
        },
      });
    } catch (error) {
      console.error("Failed to trigger update", error);
    }
  },

  getRecursiveSubflowJson: (groupId: string) => {
    const { nodes, edges } = get();
    const allDescendants: Node[] = [];

    const collectDescendants = (pid: string) => {
      const children = nodes.filter((n: Node) => n.parentNode === pid);
      children.forEach((child: Node) => {
        allDescendants.push(child);
        if (child.type === "group") {
          collectDescendants(child.id);
        }
      });
    };

    collectDescendants(groupId);

    const groupNode = nodes.find((n: Node) => n.id === groupId);
    const nodesToExport = groupNode ? [groupNode, ...allDescendants] : allDescendants;
    const descendantIds = new Set(nodesToExport.map((n) => n.id));
    const relevantEdges = edges.filter(
      (e: Edge) => descendantIds.has(e.source) && descendantIds.has(e.target)
    );

    return JSON.stringify(buildFlowJson(nodesToExport, relevantEdges), null, 2);
  },

  importSubflow: (jsonText: string, position?: { x: number; y: number }) => {
    let parsed: FlowJson;
    try {
      parsed = JSON.parse(jsonText) as FlowJson;
    } catch {
      toast.error("Invalid JSON content.");
      return;
    }

    const parsedVisualState = getVisualStateArrays(parsed);

    if (parsedVisualState.nodes.length === 0 && parsedVisualState.edges.length === 0) {
      toast.error("JSON lacks visual layout data for import.");
      return;
    }

    const { nodes: currentNodes, edges: currentEdges, currentSubflowId } = get();
    const idMap = new Map<string, string>();

    parsedVisualState.nodes.forEach((n) => idMap.set(n.id, uuidv4()));

    const incomingIds = new Set(parsedVisualState.nodes.map((n) => n.id));
    const roots = parsedVisualState.nodes.filter(
      (n) => !n.parentNode || !incomingIds.has(n.parentNode)
    );

    let offsetX = 0;
    let offsetY = 0;
    if (position && roots.length > 0) {
      const avgX = roots.reduce((sum, n) => sum + n.position.x, 0) / roots.length;
      const avgY = roots.reduce((sum, n) => sum + n.position.y, 0) / roots.length;
      offsetX = position.x - avgX;
      offsetY = position.y - avgY;
    }

    const newNodes: Node[] = parsedVisualState.nodes.map((n) => {
      const isRoot = !n.parentNode || !incomingIds.has(n.parentNode);
      const newId = idMap.get(n.id)!;
      let parentNode = n.parentNode ? idMap.get(n.parentNode) : undefined;

      if (isRoot) parentNode = currentSubflowId ?? undefined;

      const data = { ...(n.data as Record<string, any>) };

      if (data.nextNode && typeof data.nextNode === "object") {
        if (data.nextNode.defaultId) {
          data.nextNode.defaultId = idMap.get(data.nextNode.defaultId) || data.nextNode.defaultId;
        }
        if (data.nextNode.routes) {
          data.nextNode.routes = data.nextNode.routes.map((r: any) => ({
            ...r,
            gotoId: idMap.get(r.gotoId) || r.gotoId,
          }));
        }
      }
      if (data.routes) {
        data.routes = data.routes.map((r: any) => ({
          ...r,
          nextNodeId: idMap.get(r.nextNodeId) || r.nextNodeId,
        }));
      }
      ["nextNodeId", "defaultId"].forEach((key) => {
        if (data[key]) data[key] = idMap.get(data[key]) || data[key];
      });

      return {
        ...n,
        id: newId,
        parentNode,
        position: isRoot ? { x: n.position.x + offsetX, y: n.position.y + offsetY } : n.position,
        data,
        selected: false,
        extent: parentNode ? "parent" : undefined,
      } as Node;
    });

    const newEdges: Edge[] = parsedVisualState.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: uuidv4(),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      }));

    set({
      nodes: [...currentNodes, ...newNodes],
      edges: [...currentEdges, ...newEdges],
    });

    toast.success(`Imported ${newNodes.length} nodes successfully.`);
  },

  loadAllFlows: async () => {
    set({ isLoading: true });
    try {
      const { getAllFlows } = await import("@/lib/api");
      const flows = await getAllFlows();

      let backendNodes: Node[] = [];
      let backendEdges: Edge[] = [];
      const allLogicalDataMap = new Map<string, FlowNode>();

      flows.forEach((f: FlowJson) => {
        const { nodes, edges } = getVisualStateArrays(f);
        backendNodes = [...backendNodes, ...nodes];
        backendEdges = [...backendEdges, ...edges];
        f.nodes.forEach((fn) => allLogicalDataMap.set(fn.id, fn));
      });

      const backendNodeMap = new Map(backendNodes.map((n) => [n.id, n]));
      const backendEdgeMap = new Map(backendEdges.map((e) => [e.id, e]));

      const { nodes: currentNodes, edges: currentEdges } = get();

      const backendGroupIds = new Set(
        backendNodes.filter((n) => n.type === "group").map((n) => n.id)
      );

      const updatedNodes = currentNodes.reduce((acc: Node[], node: Node) => {
        if (node.parentNode && backendGroupIds.has(node.parentNode)) {
          if (!backendNodeMap.has(node.id)) {
            return acc;
          }
        }

        const backendNode = backendNodeMap.get(node.id);
        if (backendNode) {
          const freshLogicalData = allLogicalDataMap.get(node.id);
          acc.push({
            ...backendNode,
            data: { ...backendNode.data, ...freshLogicalData },
            selected: node.selected,
          } as Node);
        } else {
          acc.push(node);
        }
        return acc;
      }, []);

      const currentNodeIds = new Set(currentNodes.map((n: Node) => n.id));
      const missingNodes = backendNodes
        .filter((bn) => !currentNodeIds.has(bn.id))
        .map((bn) => {
          const freshLogicalData = allLogicalDataMap.get(bn.id);
          if (freshLogicalData) {
            return { ...bn, data: { ...bn.data, ...freshLogicalData } };
          }
          return bn;
        });

      const mergedNodes = [...updatedNodes, ...missingNodes];

      const updatedEdges = currentEdges.map((edge: Edge) => {
        const backendEdge = backendEdgeMap.get(edge.id);
        if (backendEdge) {
          return {
            ...backendEdge,
            selected: edge.selected,
          };
        }
        return edge;
      });

      const currentEdgeIds = new Set(currentEdges.map((e: Edge) => e.id));
      const missingEdges = backendEdges.filter((be) => !currentEdgeIds.has(be.id));

      const mergedEdges = [...updatedEdges, ...missingEdges];

      const nodeMap = new Map(mergedNodes.map((n) => [n.id, n]));

      for (const [id, node] of nodeMap) {
        if (node.parentNode && !nodeMap.has(node.parentNode)) {
          const { parentNode, extent, position, ...rest } = node;
          let newPos = position;
          if ((node as any).positionAbsolute) {
            newPos = { ...(node as any).positionAbsolute };
          }
          nodeMap.set(id, {
            ...rest,
            id,
            position: newPos,
            parentNode: undefined,
            extent: undefined,
          } as Node);
        }
      }

      const finalNodes = Array.from(nodeMap.values());

      const publishedGroupIdsFromBackend = flows
        .map((f: FlowJson) => {
          const { nodes } = getVisualStateArrays(f);
          const startNode = nodes.find((n) => n.type === "start");
          return startNode?.parentNode;
        })
        .filter((id): id is string => !!id);

      set({
        nodes: finalNodes,
        edges: mergedEdges,
        flow: buildFlowJson(finalNodes, mergedEdges),
        publishedGroupIds: publishedGroupIdsFromBackend,
        lastSyncedSnapshots: publishedGroupIdsFromBackend.reduce((acc, id) => {
          acc[id] = calculateFlowSnapshot(id, finalNodes, mergedEdges);
          return acc;
        }, {} as Record<string, string>),
        modifiedGroupIds: get().modifiedGroupIds.filter((groupId: string) => {
          const nodeExists = finalNodes.some((n) => n.id === groupId);
          if (!nodeExists) return false;

          const groupChildren = finalNodes.filter((n) => n.parentNode === groupId);
          const startNode = groupChildren.find((n) => n.type === "start");
          const flowName = (startNode?.data as any)?.flowName;

          const allBackendFlowNames = flows.map((f: FlowJson) => f.flowName);

          if (flowName && allBackendFlowNames.includes(flowName)) {
            const backendFlow = flows.find((f: FlowJson) => f.flowName === flowName);
            const backendNodeIds = new Set(getVisualStateArrays(backendFlow).nodes.map((n) => n.id));
            const hasLocalOnly = groupChildren.some((n) => !backendNodeIds.has(n.id));
            return hasLocalOnly;
          }

          return false;
        }),
        modifiedGroupsLog: {},
      });

      toast.success(`Loaded flows: ${missingNodes.length} new nodes added from backend.`);
    } catch (error) {
      console.error("Failed to load flows", error);
      toast.error("Failed to load flows from backend");
    } finally {
      set({ isLoading: false });
    }
  },

  refreshFlow: async (flowName: string, groupId: string) => {
    set({ isLoading: true });
    try {
      const { getFlowByName } = await import("@/lib/api");
      const flowData = await getFlowByName(flowName);
      const flow = Array.isArray(flowData) ? flowData[0] : flowData;
      const visualState = getVisualStateArrays(flow);

      if (!flow || visualState.nodes.length === 0) {
        toast.error(`Flow '${flowName}' not found or missing visual state.`);
        return;
      }

      const { nodes, edges, publishedGroupIds } = get();

      const logicalDataMap = new Map(flow.nodes.map((fn: FlowNode) => [fn.id, fn]));

      const directChildrenIds = new Set(
        nodes.filter((n: Node) => n.parentNode === groupId).map((n: Node) => n.id)
      );

      const otherNodes = nodes.filter((n: Node) => n.parentNode !== groupId);

      const backendGroupNode = visualState.nodes.find((bn: Node) => bn.id === groupId);
      const nextFlowNodes = visualState.nodes
        .filter((bn: Node) => bn.id !== groupId)
        .map((bn: Node) => {
          const freshLogicalData = logicalDataMap.get(bn.id) ?? {};
          const parentNode = bn.parentNode || groupId;
          return {
            ...bn,
            data: { ...bn.data, ...freshLogicalData },
            parentNode,
            selected: false,
            extent: parentNode ? ("parent" as const) : undefined,
          } as Node;
        });

      const finalOtherNodes = otherNodes.map((n: Node) => {
        if (n.id === groupId && backendGroupNode) {
          const freshLogicalData = logicalDataMap.get(n.id) ?? {};
          const absolutePosition = (backendGroupNode as Node & {
            positionAbsolute?: { x: number; y: number };
          }).positionAbsolute;

          return {
            ...n,
            ...backendGroupNode,
            position: absolutePosition ?? backendGroupNode.position,
            data: { ...n.data, ...backendGroupNode.data, ...freshLogicalData },
          };
        }
        return n;
      });

      const otherEdges = edges.filter(
        (e: Edge) => !directChildrenIds.has(e.source) && !directChildrenIds.has(e.target)
      );

      const nextNodes = [...finalOtherNodes, ...nextFlowNodes];
      const nextEdges = [...otherEdges, ...visualState.edges];

      let nextPublishedGroupIds = publishedGroupIds;
      if (groupId && !publishedGroupIds.includes(groupId)) {
        nextPublishedGroupIds = [...publishedGroupIds, groupId];
      }

      set({
        nodes: nextNodes,
        edges: nextEdges,
        flow: buildFlowJson(nextNodes, nextEdges),
        publishedGroupIds: nextPublishedGroupIds,
        lastSyncedSnapshots: {
          ...get().lastSyncedSnapshots,
          [groupId]: calculateFlowSnapshot(groupId, nextNodes, nextEdges),
        },
        modifiedGroupIds: get().modifiedGroupIds.filter((id: string) => id !== groupId),
        modifiedGroupsLog: {
          ...get().modifiedGroupsLog,
          [groupId]: [],
        },
      });

      toast.success(`Refreshed flow '${flowName}': Synchronized ${nextFlowNodes.length} nodes.`);
    } catch (error) {
      console.error("Failed to refresh flow", error);
      toast.error(`Failed to refresh flow '${flowName}'`);
    } finally {
      set({ isLoading: false });
    }
  },

  publishGroup: async (groupId: string) => {
    const { nodes, edges } = get();
    const { nodesToSave: rawNodesToSave, relevantEdges } = collectGroupSubtree(groupId, nodes, edges);
    const nodesToSave = normalizeGroupFlowNameForPublish(groupId, rawNodesToSave, nodes);

    const subflowJson = buildFlowJson(nodesToSave, relevantEdges);

    try {
      if (!nodesToSave.some((n: Node) => n.type === "start")) {
        throw new Error("Cannot publish a group without a Start node.");
      }

      toast.promise(createFlow(subflowJson), {
        loading: "Publishing to backend...",
        success: () => {
          const { publishedGroupIds } = get();
          if (groupId && !publishedGroupIds.includes(groupId)) {
            set({ publishedGroupIds: [...publishedGroupIds, groupId] });
          }
          return "Subflow published successfully!";
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error";
          return `Failed to publish: ${message}`;
        },
      });
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        alert(message);
      }
    }
  },

  deletePublishedFlow: async (flowName: string) => {
    const { deleteFlow } = await import("@/lib/api");
    toast.promise(deleteFlow(flowName), {
      loading: `Deleting flow '${flowName}' from backend...`,
      success: () => {
        const { publishedGroupIds, nodes } = get();
        const groupNode = nodes.find((n: Node) => {
          if (n.type !== "group") return false;
          const children = nodes.filter((child: Node) => child.parentNode === n.id);
          const startNode = children.find((child: Node) => child.type === "start");
          return (startNode?.data as any)?.flowName === flowName;
        });

        set({
          publishedGroupIds: groupNode
            ? publishedGroupIds.filter((id: string) => id !== groupNode.id)
            : publishedGroupIds,
        });
        return `Flow '${flowName}' deleted successfully!`;
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        return `Failed to delete flow: ${message}`;
      },
    });
  },

  syncNodeWithBackend: async (nodeId: string, previousName?: string) => {
    const { nodes, edges } = get();
    const node = nodes.find((n: Node) => n.id === nodeId);
    if (!node || !node.parentNode) return;

    const parentGroup = nodes.find((n: Node) => n.id === node.parentNode);
    if (!parentGroup || parentGroup.type !== "group") return;

    const groupChildren = nodes.filter((n: Node) => n.parentNode === parentGroup.id);

    const startNode = groupChildren.find((n: Node) => n.type === "start");
    if (!startNode) return;

    const flowName = String((startNode.data as Record<string, unknown>)?.flowName || "");

    if (!flowName || !get().publishedGroupIds.includes(parentGroup.id)) return;

    const childIds = groupChildren.map((n: Node) => n.id);
    const relevantEdges = edges.filter(
      (e: Edge) => childIds.includes(e.source) && childIds.includes(e.target)
    );
    const subflowJson = buildFlowJson(groupChildren, relevantEdges);
    const flowNode = subflowJson.nodes.find((fn) => fn.id === nodeId);

    if (!flowNode) return;

    const currentName = flowNode.name || nodeId;

    try {
      const { updateNodeById } = await import("@/lib/api");
      toast.promise(updateNodeById(nodeId, { node: flowNode }), {
        loading: `Syncing changes from '${currentName}'...`,
        success: () => {
          const { modifiedGroupIds } = get();
          set({
            modifiedGroupIds: modifiedGroupIds.filter((id: string) => id !== parentGroup.id),
          });
          return `Synced '${currentName}' with backend flow '${flowName}'`;
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error";
          return `Failed to sync node: ${message}`;
        },
      });
    } catch (error) {
      console.error("Failed to trigger sync", error);
    }
  },
});
