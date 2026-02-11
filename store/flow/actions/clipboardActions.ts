import { type Edge, type Node } from "reactflow";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { buildFlowJson } from "@/store/flow/serialization";
import type { FlowJson } from "@/store/flow/types";

type ClipboardActionsState = {
  nodes: Node[];
  edges: Edge[];
  clipboard: Node[] | null;
  currentSubflowId: string | null;
  flow: FlowJson;
  selectedNodeId: string | null;
};

type StoreSet = (
  partial:
    | Partial<ClipboardActionsState>
    | ((state: ClipboardActionsState) => Partial<ClipboardActionsState>)
) => unknown;
type StoreGet = () => ClipboardActionsState;

export const createClipboardActions = ({
  set,
  get,
}: {
  set: StoreSet;
  get: StoreGet;
}) => ({
copyNodes: (nodeIds: string[]) => {
  const { nodes } = get();
  // Get primary selected nodes
  const selectedNodes = nodes.filter((n) => nodeIds.includes(n.id));

  // For each node, if it's a group, we need to grab all its descendants recursively
  const nodesToCopy = new Set<Node>();

  const addNodeAndChildren = (node: Node) => {
    nodesToCopy.add(node);
    if (node.type === "group") {
      const children = nodes.filter((n) => n.parentNode === node.id);
      children.forEach(addNodeAndChildren);
    }
  };

  selectedNodes.forEach(addNodeAndChildren);
  set({ clipboard: Array.from(nodesToCopy) });
  toast.success(`Copied ${selectedNodes.length} item(s)`);
},

pasteNodes: () => {
  const { clipboard, nodes, edges, currentSubflowId } = get();
  console.log("pasteNodes called", {
    clipboardLength: clipboard?.length,
  });
  if (!clipboard || clipboard.length === 0) return;

  // Create a mapping from old ID to new ID
  const idMap = new Map<string, string>();
  const batchNames = new Set<string>();
  const resolvedNames = new Map<string, string>();

  // 1. First pass: Generate new IDs for all nodes
  clipboard.forEach((node) => {
    idMap.set(node.id, uuidv4());
  });

  // Define getUniqueName helper function
  const getUniqueName = (baseName: string) => {
    if (!baseName) return "";

    // If we already resolved this specific name in this batch, return it
    if (resolvedNames.has(baseName)) {
      return resolvedNames.get(baseName)!;
    }

    // Strip existing " copy" or " copy N" suffix to get the true base
    // internal helper to parse: "Name copy 2" -> { base: "Name", suffixNum: 2 }
    // "Name copy" -> { base: "Name", suffixNum: 1 }
    // "Name" -> { base: "Name", suffixNum: 0 }
    const nameRegex = /^(.*?)(?: copy(?: (\d+))?)?$/;
    const match = baseName.match(nameRegex);

    let coreName = baseName;
    // If we matched a copy pattern, use the captured base
    if (
      match &&
      match[1] &&
      (baseName.endsWith(" copy") || / copy \d+$/.test(baseName))
    ) {
      coreName = match[1];
    }

    let candidate = `${coreName} copy`;
    let counter = 2;

    // Helper to check if a name exists in:
    // 1. Current store nodes
    // 2. New nodes being created in this paste batch (to avoid collisions within the paste)
    const nameExists = (n: string) => {
      const inStore = nodes.some((node) => {
        const d = node.data as Record<string, unknown>;
        return d.name === n || d.flowName === n;
      });
      const inBatch = batchNames.has(n);
      return inStore || inBatch;
    };

    // First try "Name copy"
    if (!nameExists(candidate)) {
      batchNames.add(candidate);
      resolvedNames.set(baseName, candidate);
      return candidate;
    }

    // Then try "Name copy 2", "Name copy 3", etc.
    while (true) {
      candidate = `${coreName} copy ${counter}`;
      if (!nameExists(candidate)) {
        batchNames.add(candidate);
        resolvedNames.set(baseName, candidate);
        return candidate;
      }
      counter++;
    }
  };

  // 2. Second pass: Create new nodes with updated IDs and Parent pointers
  const newNodes: Node[] = clipboard.map((node) => {
    const newId = idMap.get(node.id)!;

    // Rename logic: Generate unique name with incremental suffix
    const oldData = node.data as Record<string, unknown>;
    const originalName = String(oldData.name ?? "");
    const originalFlowName = String(oldData.flowName ?? "");

    const newData = { ...oldData };
    if (originalName) newData.name = getUniqueName(originalName);
    if (originalFlowName)
      newData.flowName = getUniqueName(originalFlowName);

    // Handle parenting
    let newParentId = node.parentNode;

    // If the node's parent is ALSO in the clipboard, we map to the NEW parent ID
    if (node.parentNode && idMap.has(node.parentNode)) {
      newParentId = idMap.get(node.parentNode);
    } else {
      // Top-level relative to clipboard selection
      // If we are currently inside a subflow, paste inside it
      // BUT, if the user copied a whole group structure, the roots of that structure
      // should go into currentSubflowId.
      // If parentNode is undefined/null in clipboard, it goes to currentSubflowId.
      // If parentNode is NOT in clipboard, it means we copied a child without its parent?
      // -> In that case, we treat it as a new root in the current context.
      newParentId = currentSubflowId || undefined;
    }

    // Offset position slightly to show it's a copy
    // Only offset if it's a root of the paste operation (i.e. parent is not in clipboard)
    const position = { ...node.position };
    if (!node.parentNode || !idMap.has(node.parentNode)) {
      position.x += 20;
      position.y += 20;
    }

    return {
      ...node,
      id: newId,
      data: newData,
      parentNode: newParentId,
      position,
      selected: true, // Select the pasted nodes
      extent: newParentId ? "parent" : undefined,
    };
  });

  // Deselect current nodes
  const deselectedNodes = nodes.map((n) => ({ ...n, selected: false }));

  const finalNodes = [...deselectedNodes, ...newNodes];

  // We also need to copy internal edges if their source/target are both in clipboard
  // We find existing edges that connect nodes within the clipboard
  const internalEdges = edges.filter(
    (e) => idMap.has(e.source) && idMap.has(e.target)
  );

  const newEdges = internalEdges.map((e) => ({
    ...e,
    id: uuidv4(),
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
    selected: false,
  }));

  set({
    nodes: finalNodes,
    edges: [...edges, ...newEdges],
    flow: buildFlowJson(finalNodes, [...edges, ...newEdges]),
    selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
  });

  toast.success("Pasted nodes");
},
});
