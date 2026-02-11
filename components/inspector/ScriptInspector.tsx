import NodeNameInput from "./NodeNameInput";
import TargetNodeDisplay from "./TargetNodeDisplay";
import { useEffect, useRef } from "react";
import type { Edge, Node } from "reactflow";
import { toast } from "sonner";
import { useFlowStore } from "@/store/flow/flowStore";

type ScriptInspectorProps = {
  node: Node;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

type ScriptRoute = {
  id: string;
  key?: string;
  nextNodeId?: string;
  nextNodeName?: string;
};

export default function ScriptInspector({ node, updateNodeData }: ScriptInspectorProps) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setEdges = useFlowStore((s) => s.setEdges);
  const nextNodeId =
    typeof node.data?.nextNode === "string" ? node.data.nextNode : "";
  const nextNode = nodes.find((n) => n.id === nextNodeId);
  const routes = (node.data?.routes as ScriptRoute[]) || [];
  const lastWarningKey = useRef<string | null>(null);
  const scriptValue = String(node.data?.script ?? "");

  const getScriptScopeNodes = () => {
    const current = nodes.find((n) => n.id === node.id) ?? node;
    const parentId = current.parentNode ?? null;
    return nodes.filter((n) => (n.parentNode || null) === parentId);
  };

  const parseScriptRoutes = (script: string) => {
    const matches: Array<{ condition: string; nextName: string }> = [];
    const len = script.length;

    const isIdentChar = (ch: string) => /[A-Za-z0-9_$]/.test(ch);

    const skipWhitespace = (idx: number) => {
      let i = idx;
      while (i < len && /\s/.test(script[i])) i += 1;
      return i;
    };

    const skipLineComment = (idx: number) => {
      let i = idx;
      while (i < len && script[i] !== "\n") i += 1;
      return i;
    };

    const skipBlockComment = (idx: number) => {
      let i = idx + 2;
      while (i < len) {
        if (script[i] === "*" && script[i + 1] === "/") return i + 2;
        i += 1;
      }
      return len;
    };

    const skipString = (idx: number) => {
      const quote = script[idx];
      let i = idx + 1;
      while (i < len) {
        const ch = script[i];
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === quote) return i + 1;
        i += 1;
      }
      return len;
    };

    const skipTemplate = (idx: number) => {
      let i = idx + 1;
      while (i < len) {
        const ch = script[i];
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === "`") return i + 1;
        i += 1;
      }
      return len;
    };

    const parseCondition = (idx: number) => {
      let i = skipWhitespace(idx);
      if (script[i] !== "(") return null;
      i += 1;
      const start = i;
      let depth = 1;
      while (i < len) {
        const ch = script[i];
        const next = script[i + 1];
        if (ch === "/" && next === "/") {
          i = skipLineComment(i + 2);
          continue;
        }
        if (ch === "/" && next === "*") {
          i = skipBlockComment(i);
          continue;
        }
        if (ch === "'" || ch === '"') {
          i = skipString(i);
          continue;
        }
        if (ch === "`") {
          i = skipTemplate(i);
          continue;
        }
        if (ch === "(") depth += 1;
        if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            const condition = script.slice(start, i);
            return { condition, nextIndex: i + 1 };
          }
        }
        i += 1;
      }
      return null;
    };

    const parseBlock = (idx: number) => {
      let i = skipWhitespace(idx);
      if (script[i] !== "{") return null;
      i += 1;
      const start = i;
      let depth = 1;
      while (i < len) {
        const ch = script[i];
        const next = script[i + 1];
        if (ch === "/" && next === "/") {
          i = skipLineComment(i + 2);
          continue;
        }
        if (ch === "/" && next === "*") {
          i = skipBlockComment(i);
          continue;
        }
        if (ch === "'" || ch === '"') {
          i = skipString(i);
          continue;
        }
        if (ch === "`") {
          i = skipTemplate(i);
          continue;
        }
        if (ch === "{") depth += 1;
        if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            const block = script.slice(start, i);
            return { block, nextIndex: i + 1 };
          }
        }
        i += 1;
      }
      return null;
    };

    const parseElseBlock = (idx: number) => {
      let i = skipWhitespace(idx);
      if (
        script[i] !== "e" ||
        script[i + 1] !== "l" ||
        script[i + 2] !== "s" ||
        script[i + 3] !== "e"
      ) {
        return null;
      }
      if (isIdentChar(script[i - 1] || "") || isIdentChar(script[i + 4] || "")) {
        return null;
      }
      i += 4;
      i = skipWhitespace(i);
      if (
        script[i] === "i" &&
        script[i + 1] === "f" &&
        !isIdentChar(script[i - 1] || "") &&
        !isIdentChar(script[i + 2] || "")
      ) {
        return { type: "elseif" as const, nextIndex: i };
      }
      const blockResult = parseBlock(i);
      if (!blockResult) return null;
      return {
        type: "else" as const,
        block: blockResult.block,
        nextIndex: blockResult.nextIndex,
      };
    };

    const seenNextNames = new Set<string>();
    const nextNodeRegex = /nextNode\s*:\s*["'`]([^"'`]+)["'`]/g;

    const addFromBlock = (block: string, condition: string) => {
      let match: RegExpExecArray | null;
      while ((match = nextNodeRegex.exec(block))) {
        const nextName = match[1]?.trim();
        if (!nextName || seenNextNames.has(nextName)) continue;
        seenNextNames.add(nextName);
        matches.push({ condition, nextName });
      }
      nextNodeRegex.lastIndex = 0;
    };

    let i = 0;
    while (i < len) {
      const ch = script[i];
      const next = script[i + 1];
      if (ch === "/" && next === "/") {
        i = skipLineComment(i + 2);
        continue;
      }
      if (ch === "/" && next === "*") {
        i = skipBlockComment(i);
        continue;
      }
      if (ch === "'" || ch === '"') {
        i = skipString(i);
        continue;
      }
      if (ch === "`") {
        i = skipTemplate(i);
        continue;
      }

      if (
        ch === "i" &&
        script[i + 1] === "f" &&
        !isIdentChar(script[i - 1] || "") &&
        !isIdentChar(script[i + 2] || "")
      ) {
        const conditionResult = parseCondition(i + 2);
        if (!conditionResult) {
          i += 2;
          continue;
        }
        const blockResult = parseBlock(conditionResult.nextIndex);
        if (!blockResult) {
          i = conditionResult.nextIndex;
          continue;
        }
        addFromBlock(blockResult.block, conditionResult.condition.trim());

        const elseResult = parseElseBlock(blockResult.nextIndex);
        if (elseResult?.type === "else") {
          addFromBlock(elseResult.block, "");
          i = elseResult.nextIndex;
          continue;
        }
        if (elseResult?.type === "elseif") {
          i = elseResult.nextIndex;
          continue;
        }
        i = blockResult.nextIndex;
        continue;
      }

      i += 1;
    }

    i = 0;
    while (i < len) {
      const ch = script[i];
      const next = script[i + 1];
      if (ch === "/" && next === "/") {
        i = skipLineComment(i + 2);
        continue;
      }
      if (ch === "/" && next === "*") {
        i = skipBlockComment(i);
        continue;
      }
      if (ch === "'" || ch === '"') {
        i = skipString(i);
        continue;
      }
      if (ch === "`") {
        i = skipTemplate(i);
        continue;
      }

      if (
        ch === "n" &&
        script.slice(i, i + 8) === "nextNode" &&
        !isIdentChar(script[i - 1] || "") &&
        !isIdentChar(script[i + 8] || "")
      ) {
        const snippet = script.slice(i);
        const nextNodeMatch = snippet.match(
          /^nextNode\s*:\s*["'`]([^"'`]+)["'`]/
        );
        if (nextNodeMatch?.[1]) {
          const nextName = nextNodeMatch[1].trim();
          if (!seenNextNames.has(nextName)) {
            seenNextNames.add(nextName);
            matches.push({ condition: "", nextName });
          }
          i += nextNodeMatch[0].length;
          continue;
        }
      }

      i += 1;
    }

    return matches;
  };

  const syncEdgesForRoutes = (routeList: ScriptRoute[]) => {
    if (routeList.length === 0) return;
    setEdges((prevEdges) => {
      const routeIdSet = new Set(routeList.map((r) => r.id));
      const baseEdges = prevEdges.filter((edge) => {
        if (edge.source !== node.id) return true;
        if (!edge.sourceHandle || edge.sourceHandle === "default") return true;
        return routeIdSet.has(edge.sourceHandle);
      });

      let updatedEdges = [...baseEdges];
      routeList.forEach((route) => {
        if (!route.nextNodeId) return;
        const existingIdx = updatedEdges.findIndex(
          (edge) => edge.source === node.id && edge.sourceHandle === route.id
        );
        if (existingIdx !== -1) {
          if (updatedEdges[existingIdx].target === route.nextNodeId) return;
          updatedEdges = [
            ...updatedEdges.slice(0, existingIdx),
            ...updatedEdges.slice(existingIdx + 1),
          ];
        }
        const newEdge: Edge = {
          id: `e-${node.id}-${route.id}-${route.nextNodeId}`,
          source: node.id,
          target: route.nextNodeId,
          sourceHandle: route.id,
          targetHandle: null,
        };
        updatedEdges = [...updatedEdges, newEdge];
      });

      const edgesUnchanged =
        updatedEdges.length === prevEdges.length &&
        updatedEdges.every((edge) =>
          prevEdges.some(
            (existing) =>
              existing.id === edge.id &&
              existing.source === edge.source &&
              existing.target === edge.target &&
              existing.sourceHandle === edge.sourceHandle
          )
        );

      return edgesUnchanged ? prevEdges : updatedEdges;
    });
  };

  const hashId = (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return `sr-${Math.abs(hash)}`;
  };

  useEffect(() => {
    const script = String(node.data?.script ?? "");
    const parsed = parseScriptRoutes(script);
    const scopedNodes = getScriptScopeNodes();
    const unresolved: string[] = [];

    const nextRoutes: ScriptRoute[] = parsed.map((item) => {
      const targetName = item.nextName.trim();
      const existingRoute = routes.find((route) => {
        const storedName = String(route.nextNodeName ?? "").trim();
        if (storedName && storedName === targetName) return true;
        if (!route.nextNodeId) return false;
        const targetNode = scopedNodes.find((n) => n.id === route.nextNodeId);
        const nodeName = String(
          (targetNode?.data as Record<string, unknown>)?.name ?? ""
        ).trim();
        return nodeName && nodeName === targetName;
      });
      const candidates = scopedNodes.filter((n) => {
        const nodeName = String((n.data as Record<string, unknown>)?.name ?? "").trim();
        if (nodeName && nodeName === targetName) return true;
        if (n.type === "group") {
          const children = scopedNodes.filter((child) => child.parentNode === n.id);
          const startNode = children.find((child) => child.type === "start");
          const flowName = String((startNode?.data as { flowName?: string } | undefined)?.flowName ?? "").trim();
          return flowName && flowName === targetName;
        }
        return false;
      });
      const nextNodeId = candidates.length === 1 ? candidates[0].id : "";
      if (!nextNodeId) {
        unresolved.push(item.nextName || "(empty)");
      }
      return {
        id: existingRoute?.id || hashId(item.nextName),
        key: existingRoute?.key ?? item.condition,
        nextNodeId,
        nextNodeName: targetName,
      };
    });

    const routesUnchanged =
      routes.length === nextRoutes.length &&
      routes.every((route, idx) => {
        const next = nextRoutes[idx];
        return (
          route?.id === next?.id &&
          String(route?.key ?? "") === String(next?.key ?? "") &&
          String(route?.nextNodeId ?? "") === String(next?.nextNodeId ?? "") &&
          String(route?.nextNodeName ?? "") === String(next?.nextNodeName ?? "")
        );
      });

    if (unresolved.length > 0) {
      const list = Array.from(new Set(unresolved)).join(", ");
      const key = `missing:${list}`;
      if (lastWarningKey.current !== key) {
        lastWarningKey.current = key;
        toast.warning(
          `Could not auto-connect route(s): ${list}. Name not found or not unique in this flow.`
        );
      }
    } else if (lastWarningKey.current) {
      lastWarningKey.current = null;
    }
    if (!routesUnchanged) {
      updateNodeData(node.id, { routes: nextRoutes });
    }

    let raf = 0;
    if (nextRoutes.length > 0) {
      raf = window.requestAnimationFrame(() => syncEdgesForRoutes(nextRoutes));
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [node.id, node.data?.script, nodes, edges, routes, updateNodeData, setEdges]);

  return (
    <div className="space-y-4">
      <NodeNameInput
        nodeId={node.id}
        name={String(node.data?.name ?? "")}
        onNameChange={(value) => updateNodeData(node.id, { name: value })}
        label="Name *"
      />

      {!String(node.data?.name ?? "").trim() && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Script node name is required before you can finish.
        </div>
      )}

      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">
          Script
        </label>
        <textarea
          className="w-full resize-y rounded-lg border-2 border-gray-100 bg-gray-50/50 px-3 py-2 text-sm text-gray-900 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none"
          rows={8}
          value={scriptValue}
          onChange={(e) => updateNodeData(node.id, { script: e.target.value })}
          spellCheck={false}
          placeholder="Write your script here..."
        />
      </div>

      <div className="rounded-lg border border-gray-100 bg-white/80 p-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase text-gray-400">
            Script Routes
          </label>
        </div>

        {routes.length === 0 ? (
          <div className="mt-2 text-[10px] text-gray-400">
            No routes detected yet. Add a return with nextNode in the script.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {routes.map((route, idx) => (
              <div
                key={route.id || idx}
                className="grid grid-cols-[1fr_auto] items-center gap-2"
              >
                <input
                  className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 shadow-sm"
                  placeholder="Route key (e.g. no_accounts)"
                  value={String(route.key ?? "")}
                  onChange={(e) => {
                    const next = [...routes];
                    next[idx] = { ...route, key: e.target.value };
                    updateNodeData(node.id, { routes: next });
                  }}
                />
                <div className="col-span-2">
                  <div className="text-[9px] font-semibold uppercase text-gray-400 mb-1">
                    Target
                  </div>
                  <TargetNodeDisplay
                    nodeId={route.nextNodeId || ""}
                    label=""
                    title="Connect this route handle on the canvas"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs text-gray-600">
        <span className="font-semibold uppercase">Next Node</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              nextNodeId
                ? "bg-emerald-100 text-emerald-800"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {nextNodeId
              ? `Connected to ${String(nextNode?.data?.name || "Untitled")}`
              : "Not connected"}
          </span>
        </div>
      </div>
    </div>
  );
}
