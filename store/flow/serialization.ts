import { type Edge, type Node } from "reactflow";

import { type FlowJson, type FlowNode, type FlowRoute } from "./types";

/**
 * Traces up the parent hierarchy of a node to find the nearest ancestor
 * container that defines a flow (contains a Start node).
 * Returns both the groupId and the flowName.
 */
export const getParentGroupInfo = (
  nodes: Node[],
  nodeId: string
): { groupId: string; flowName: string } | null => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const parentId = node.parentNode;
  if (!parentId) return null;

  const children = nodes.filter((n) => n.parentNode === parentId);
  const startNode = children.find((n) => n.type === "start");
  if (startNode) {
    return {
      groupId: parentId,
      flowName: (startNode.data.flowName as string) || "",
    };
  }

  // If not found in immediate parent, trace up recursively
  return getParentGroupInfo(nodes, parentId);
};

export const getFlowLeafName = (flowName: string): string =>
  String(flowName ?? "")
    .split("/")
    .filter(Boolean)
    .slice(-1)[0] ?? "";

export const getNamespacedGroupFlowName = (
  nodes: Node[],
  groupId: string,
  rawName: string
): string => {
  const leafName = getFlowLeafName(String(rawName ?? "").trim());
  if (!leafName) {
    return "";
  }

  const parentInfo = getParentGroupInfo(nodes, groupId);
  const namespace = String(parentInfo?.flowName ?? "").trim();
  if (!namespace) {
    return leafName;
  }

  if (leafName === getFlowLeafName(namespace)) {
    return namespace;
  }

  return `${namespace}/${leafName}`;
};

const resolveExecutableTarget = (
  nodes: Node[],
  currentFlowName: string,
  target: { id: string; name: string }
): { nodeId?: string; flowName?: string; groupId?: string } => {
  if (!target.id) {
    return {};
  }

  const targetNode = nodes.find((node) => node.id === target.id);
  if (!targetNode || targetNode.type !== "group") {
    return { nodeId: target.id };
  }

  const groupChildren = nodes.filter((candidate) => candidate.parentNode === target.id);
  const groupStartNode = groupChildren.find((candidate) => candidate.type === "start");
  const startData = ((groupStartNode?.data as Record<string, unknown> | undefined) ?? {});
  const groupFlowName = String(startData.flowName ?? target.name ?? "").trim();
  const groupEntryNodeId = String(startData.entryNodeId ?? startData.entryNode ?? "").trim();

  if (groupFlowName && groupFlowName !== currentFlowName) {
    return { flowName: groupFlowName, groupId: target.id };
  }

  if (groupEntryNodeId) {
    return { nodeId: groupEntryNodeId, groupId: target.id };
  }

  return { groupId: target.id };
};

/**
 * Generates a stable JSON string of the logical structure of a group's flow.
 * Used for deep comparison (Smart Diff) to detect IF meaningful changes exist.
 */
export const calculateFlowSnapshot = (groupId: string, nodes: Node[], edges: Edge[]): string => {
  const groupNode = nodes.find((n) => n.id === groupId);
  const children = nodes.filter((n) => n.parentNode === groupId);
  const nodesInSnapshot = groupNode ? [groupNode, ...children] : children;
  const childIds = new Set(children.map((n) => n.id));
  const innerEdges = edges.filter((e) => childIds.has(e.source) && childIds.has(e.target));

  const cleanNodes = nodesInSnapshot
    .map((n) => {
      // Extract only logical data, ignoring internal React Flow props like width/height
      const {
        name,
        flowName,
        message,
        nextNode,
        nextNodeId,
        isMainMenu,
        isMenuBranch,
        ...otherData
      } = (n.data as Record<string, any>) || {};

      // We keep other data too but we want to be careful about what contributes to a "change"
      // For now, let's just use the whole data but remove known noisy fields if any
      const logicalData = {
        name,
        flowName,
        message,
        nextNode,
        nextNodeId,
        isMainMenu,
        isMenuBranch,
        ...otherData,
      };

      return {
        id: n.id,
        type: n.type,
        data: logicalData,
        position: {
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
        },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const cleanEdges = innerEdges
    .map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }))
    .sort((a, b) => (a.source + a.target).localeCompare(b.source + b.target));

  return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const replaceNextNodeNameInScript = (script: string, oldName: string, newName: string) => {
  if (!script || !oldName || oldName === newName) return script;
  const escaped = escapeRegExp(oldName);
  const pattern = new RegExp(`(\\bnextNode\\s*:\\s*)(['"\`])${escaped}\\2`, "g");
  return script.replace(pattern, (_match, prefix, quote) => {
    return `${prefix}${quote}${newName}${quote}`;
  });
};

export const buildFlowJson = (nodes: Node[], edges: Edge[]): FlowJson => {
  const sanitizedVisualNodes = nodes.map((node) => {
    const absolutePosition =
      !node.parentNode &&
      (node as unknown as { positionAbsolute?: { x?: number; y?: number } }).positionAbsolute &&
      typeof (node as unknown as { positionAbsolute?: { x?: number; y?: number } }).positionAbsolute
        ?.x === "number" &&
      typeof (node as unknown as { positionAbsolute?: { x?: number; y?: number } }).positionAbsolute
        ?.y === "number"
        ? {
            x: (node as unknown as { positionAbsolute: { x: number; y: number } }).positionAbsolute.x,
            y: (node as unknown as { positionAbsolute: { x: number; y: number } }).positionAbsolute.y,
          }
        : node.position;

    if (node.type !== "prompt") return { ...node, position: absolutePosition };
    const data = { ...((node.data as Record<string, unknown>) || {}) };
    delete data.routingMode;
    delete data.pagination;
    delete data.hasMultiplePage;
    delete data.indexPerPage;
    return { ...node, position: absolutePosition, data };
  });

  const nameById = new Map<string, string>();
  const idByName = new Map<string, string>();
  const typeById = new Map<string, string>();

  nodes.forEach((node) => {
    if (node.type === "start") return;
    const name = String((node.data as Record<string, unknown>)?.name ?? "");
    typeById.set(node.id, node.type || "");
    // Always map ID to name (or empty string/Unnamed)
    nameById.set(node.id, name || "");
    if (name) {
      idByName.set(name, node.id);
    }
  });

  const resolveTarget = (value?: string | unknown) => {
    if (typeof value !== "string" || !value) return { id: "", name: "" };

    // 1. Initial lookup
    let targetId = "";
    if (nameById.has(value)) {
      targetId = value;
    } else if (idByName.has(value)) {
      targetId = idByName.get(value) || "";
    } else {
      return { id: "", name: value };
    }

    return { id: targetId, name: nameById.get(targetId) || "" };
  };

  const startNode =
    nodes.find((node) => node.type === "start" && !node.parentNode) ||
    nodes.find((node) => node.type === "start");
  const startData = (startNode?.data as Record<string, unknown>) || {};
  const flowName = String(startData.flowName ?? "");
  const entryNodeRaw = String(startData.entryNodeId ?? startData.entryNode ?? "");
  const entryResolved = resolveTarget(entryNodeRaw);
  const executableEntryTarget = resolveExecutableTarget(nodes, flowName, entryResolved);

  const flowNodes: FlowNode[] = nodes
    .filter((node) => node.type !== "start" && node.type !== "group")
    .map((node) => {
      const data = (node.data as Record<string, unknown>) || {};
      const base: FlowNode = {
        id: node.id,
        name: String(data.name ?? ""),
        type: String(node.type ?? ""),
      };

      if (node.type === "prompt" && data.isMainMenu) {
        base.isMainMenu = true;
      }

      if (node.type === "prompt") {
        const message = String(data.message ?? "");
        const nextNode = data.nextNode;
        const persistSourceField = String(data.persistSourceField ?? "");
        const persistFieldName = String(data.persistFieldName ?? "");
        const indexedListVar = String(data.indexedListVar ?? "");
        const invalidInputMessage = String(
          (data as Record<string, unknown>).invalidInputMessage ??
            (data as Record<string, unknown>).invalidIndexMessage ??
            ""
        );
        const emptyInputMessage = String(data.emptyInputMessage ?? "");
        const inputType = String(data.inputType ?? (data.inputValidationEnabled ? "STRING" : ""));
        const invalidInputTypeMessage = String(data.invalidInputTypeMessage ?? "");
        const promptExtras: Partial<FlowNode> = {
          responseFormat:
            data.responseFormat === "soap" ||
            data.responseFormat === "json" ||
            data.responseFormat === "ussd"
              ? data.responseFormat
              : undefined,
          responseBodyMapping:
            data.responseBodyMapping &&
            typeof data.responseBodyMapping === "object" &&
            !Array.isArray(data.responseBodyMapping)
              ? (data.responseBodyMapping as Record<string, unknown>)
              : undefined,
          responseBodyRaw:
            typeof data.responseBodyRaw === "string" && data.responseBodyRaw.trim().length > 0
              ? data.responseBodyRaw
              : undefined,
          responseHeaders:
            data.responseHeaders &&
            typeof data.responseHeaders === "object" &&
            !Array.isArray(data.responseHeaders)
              ? (data.responseHeaders as Record<string, unknown>)
              : undefined,
          responseStatusCode:
            typeof data.responseStatusCode === "number" &&
            Number.isFinite(data.responseStatusCode)
              ? data.responseStatusCode
              : undefined,
          persistByIndex:
            typeof data.persistByIndex === "boolean" ? data.persistByIndex : undefined,
          persistByIndexValue:
            typeof data.persistByIndexValue === "string" ? data.persistByIndexValue : undefined,
          persistSourceField: persistSourceField || undefined,
          persistFieldName: persistFieldName || undefined,
          validateIndexedList:
            typeof data.validateIndexedList === "boolean" ? data.validateIndexedList : undefined,
          indexedListVar: indexedListVar || undefined,
          invalidInputMessage: invalidInputMessage || undefined,
          emptyInputMessage: emptyInputMessage || undefined,
          inputType: (inputType || undefined) as FlowNode["inputType"],
          invalidInputTypeMessage: invalidInputTypeMessage || undefined,
          inputValidationEnabled:
            typeof data.inputValidationEnabled === "boolean"
              ? data.inputValidationEnabled
              : undefined,
          persistInput: typeof data.persistInput === "boolean" ? data.persistInput : undefined,
          persistInputAs: String(data.persistInputAs ?? "") || undefined,
          saveSessionStep:
            typeof data.saveSessionStep === "boolean" ? data.saveSessionStep : undefined,
          sessionStepSessionId: String(data.sessionStepSessionId ?? "") || undefined,
          responseType: (data.responseType as any) || "CONTINUE",
          encryptInput: typeof data.encryptInput === "boolean" ? data.encryptInput : undefined,
        };

        const isMenuMode =
          !!nextNode &&
          typeof nextNode === "object" &&
          Array.isArray((nextNode as { routes?: unknown[] }).routes);

        if (!isMenuMode) {
          let targetStr = "";
          if (typeof nextNode === "string") {
            targetStr = nextNode;
          } else if (nextNode && typeof nextNode === "object") {
            targetStr = (nextNode as any).defaultId || (nextNode as any).default || "";
          }

          const resolved = resolveTarget(targetStr);
          const executableTarget = resolveExecutableTarget(nodes, flowName, resolved);
          const finalId =
            executableTarget.nodeId ||
            resolved.id ||
            (targetStr && nameById.has(targetStr) ? targetStr : "") ||
            targetStr ||
            "";

          if (executableTarget.flowName) {
            return {
              ...base,
              message,
              ...promptExtras,
              nextNode: {
                routes: [],
                default: "",
                defaultId: "",
                defaultFlow: executableTarget.flowName,
              },
              nextNodeId: "",
            };
          }

          return {
            ...base,
            message,
            ...promptExtras,
            nextNode: finalId,
            nextNodeId: finalId,
          };
        }

        let routes: FlowRoute[] = [];
        let defaultName = "";
        let defaultId = "";
        let defaultFlow = "";

        if (nextNode && typeof nextNode === "object") {
          const nextObj = nextNode as {
            routes?: Array<{
              when?: Record<string, unknown>;
              gotoFlow?: string;
              goto?: string;
              gotoId?: string;
            }>;
            default?: string;
            defaultId?: string;
          };
          routes = (nextObj.routes || []).map((route) => {
            const r = route as any;
            const when = route.when;

            if (r.toMainMenu || r.isMainMenu) {
              return {
                when,
                toMainMenu: true,
              } as FlowRoute;
            }

            if (r.isGoBack) {
              const routeObj: FlowRoute = {
                when,
                goto: r.goBackTargetId || r.goBackTarget || r.gotoFlow || "",
                gotoId: r.goBackTargetId || r.goBackTarget || "",
                isGoBack: true,
                goBackTarget: r.goBackTargetId || r.goBackTarget || "",
                goBackTargetId: r.goBackTargetId || r.goBackTarget || "",
              };
              if (r.goBackToFlow && r.goBackToFlow !== flowName) {
                routeObj.goBackToFlow = r.goBackToFlow;
              }
              return routeObj;
            }

            const target = resolveTarget(route.gotoId || route.goto || route.gotoFlow || "");
            const executableTarget = resolveExecutableTarget(nodes, flowName, target);

            if (executableTarget.flowName) {
              return {
                when,
                gotoFlow: executableTarget.flowName,
                gotoId: executableTarget.groupId || target.id || "",
              } as FlowRoute;
            }

            return {
              when,
              goto: executableTarget.nodeId || target.id || "",
              gotoId: executableTarget.nodeId || target.id || "",
            } as FlowRoute;
          });
          const defaultResolved = resolveTarget(nextObj.defaultId || nextObj.default || "");
          const defaultExecutableTarget = resolveExecutableTarget(nodes, flowName, defaultResolved);
          defaultName = defaultExecutableTarget.nodeId || defaultResolved.id || "";
          defaultId = defaultExecutableTarget.nodeId || defaultResolved.id || "";
          defaultFlow = defaultExecutableTarget.flowName || "";
        } else if (typeof nextNode === "string" && nextNode) {
          const resolved = resolveTarget(nextNode);
          const defaultExecutableTarget = resolveExecutableTarget(nodes, flowName, resolved);
          defaultName = defaultExecutableTarget.nodeId || resolved.id || "";
          defaultId = defaultExecutableTarget.nodeId || resolved.id || "";
          defaultFlow = defaultExecutableTarget.flowName || "";
        }

        return {
          ...base,
          message,
          ...promptExtras,
          nextNode: {
            routes,
            default: defaultName,
            defaultId: defaultId,
            defaultFlow: defaultFlow || undefined,
          },
        };
      }

      if (node.type === "action") {
        const rawFields = Array.isArray(data.fields)
          ? data.fields
          : data.field
            ? [String(data.field)]
            : [];
        const rawOutputVars = Array.isArray(data.outputVars)
          ? data.outputVars
          : data.outputVar
            ? [String(data.outputVar)]
            : [];
        const fields = rawFields.map((value) => String(value ?? ""));
        const outputVars = (rawOutputVars.length ? rawOutputVars : fields).map((value) =>
          String(value ?? "")
        );

        const hasLocalSource =
          Boolean(data.dataSource) ||
          fields.length > 0 ||
          outputVars.length > 0 ||
          Boolean(data.field) ||
          Boolean(data.outputVar);
        const wsUrl = String(data.wsUrl ?? "");
        const wsCurl = String(data.wsCurl ?? "");
        const wsProtocols = Array.isArray(data.wsProtocols)
          ? data.wsProtocols
              .map((value) => String(value ?? "").trim())
              .filter((value) => value.length > 0)
          : [];
        const wsMessage = String(data.wsMessage ?? "");
        const wsLastMessage = String(data.wsLastMessage ?? "");
        const hasWebSocketSource =
          Boolean(wsUrl) ||
          Boolean(wsCurl) ||
          wsProtocols.length > 0 ||
          Boolean(wsMessage) ||
          Boolean(wsLastMessage);
        const requestSourceRaw = String(data.requestSource ?? "");
        const requestSource =
          requestSourceRaw === "local" || requestSourceRaw === "ws" || requestSourceRaw === "api"
            ? requestSourceRaw
            : hasWebSocketSource
              ? "ws"
              : hasLocalSource
                ? "local"
                : "api";
        const formatValue = data.format as "indexedList" | "singleValue" | undefined;
        const routes = (
          (data.routes as Array<{ condition?: string; nextNodeId?: string }>) || []
        ).map((route) => {
          let when: Record<string, unknown> | undefined;
          if (route.condition) {
            try {
              when = JSON.parse(route.condition) as Record<string, unknown>;
            } catch {
              when = { raw: route.condition };
            }
          }
          const target = resolveTarget(route.nextNodeId || "");
          const executableTarget = resolveExecutableTarget(nodes, flowName, target);
          return {
            when,
            goto: executableTarget.nodeId || target.id,
            gotoId: executableTarget.nodeId || target.id,
            gotoFlow: executableTarget.flowName,
          };
        });

        const nextNodeRaw =
          typeof data.nextNode === "string"
            ? data.nextNode
            : data.nextNode && typeof data.nextNode === "object"
              ? (data.nextNode as any).defaultId || (data.nextNode as any).default
              : "";
        const defaultResolved = resolveTarget(nextNodeRaw || "");
        const defaultExecutableTarget = resolveExecutableTarget(nodes, flowName, defaultResolved);

        return {
          ...base,
          requestSource,
          endpoint: String(data.endpoint ?? ""),
          method: String(data.method ?? ""),
          curl: String(data.curl ?? "") || undefined,
          wsCurl: wsCurl || undefined,
          wsUrl: wsUrl || undefined,
          wsProtocols: wsProtocols.length > 0 ? wsProtocols : undefined,
          wsMessage: wsMessage || undefined,
          wsLastMessage: wsLastMessage || undefined,
          dataSource: String(data.dataSource ?? ""),
          fields: fields.length > 0 ? fields : undefined,
          outputVars: outputVars.length > 0 ? outputVars : undefined,
          format: hasLocalSource ? formatValue || "indexedList" : formatValue,
          headers: (data.headers as Record<string, unknown>) || undefined,
          apiBody: (data.apiBody as Record<string, unknown>) || undefined,
          apiBodyRaw: String(data.apiBodyRaw ?? "") || undefined,
          bodyMode:
            data.bodyMode === "json" || data.bodyMode === "soap" || data.bodyMode === "form"
              ? data.bodyMode
              : undefined,
          responseMapping: data.responseMapping
            ? Object.fromEntries(
                Object.entries(data.responseMapping as Record<string, string>).map(([k, v]) => {
                  if (typeof v === "string") {
                    return [k, v];
                  }
                  return [k, v];
                })
              )
            : undefined,
          persistResponseMappingKeys: (data.persistResponseMappingKeys as string[]) || undefined,
          maskedResponseMappingKeys: (data.maskedResponseMappingKeys as string[]) || undefined,
          encryptResponseMappingKeys: (data.encryptResponseMappingKeys as string[]) || undefined,
          nextNode: {
            routes,
            default: defaultExecutableTarget.nodeId || defaultResolved.id || "",
            defaultId: defaultExecutableTarget.nodeId || defaultResolved.id || "",
            defaultFlow: defaultExecutableTarget.flowName,
          },
        };
      }

      if (node.type === "functionCall") {
        const functionName = String((data as any).functionName ?? "");
        const saveAs = String((data as any).saveAs ?? "");
        const nextNodeRaw = typeof data.nextNode === "string" ? data.nextNode : "";
        const resolved = resolveTarget(nextNodeRaw || "");
        const executableTarget = resolveExecutableTarget(nodes, flowName, resolved);

        let args: Record<string, unknown> | undefined;
        const rawArgs = (data as any).args;
        if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
          args = rawArgs as Record<string, unknown>;
        } else if (typeof rawArgs === "string") {
          try {
            const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              args = parsed;
            }
          } catch {
            args = undefined;
          }
        }

        return {
          ...base,
          functionName,
          args: args ?? {},
          saveAs,
          nextNode:
            executableTarget.nodeId || executableTarget.flowName
              ? {
                  routes: [],
                  default: executableTarget.nodeId || resolved.id || "",
                  defaultId: executableTarget.nodeId || resolved.id || "",
                  defaultFlow: executableTarget.flowName,
                }
              : "",
        };
      }

      if (node.type === "script") {
        const nextNodeRaw = typeof data.nextNode === "string" ? data.nextNode : "";
        const resolved = resolveTarget(nextNodeRaw || "");
        const executableTarget = resolveExecutableTarget(nodes, flowName, resolved);
        const routesRaw =
          (data.routes as Array<{ id?: string; key?: string; nextNodeId?: string }>) || [];
        const scriptRoutes = routesRaw.map((route) => {
          const target = resolveTarget(route.nextNodeId || "");
          const executableRouteTarget = resolveExecutableTarget(nodes, flowName, target);
          return {
            key: route.key,
            goto: executableRouteTarget.nodeId || target.id,
            gotoId: executableRouteTarget.nodeId || target.id,
            gotoFlow: executableRouteTarget.flowName,
          };
        });
        return {
          ...base,
          script: String(data.script ?? ""),
          timeoutMs: 25,
          nextNode:
            executableTarget.nodeId || executableTarget.flowName
              ? {
                  routes: [],
                  default: executableTarget.nodeId || resolved.id || "",
                  defaultId: executableTarget.nodeId || resolved.id || "",
                  defaultFlow: executableTarget.flowName,
                }
              : "",
          scriptRoutes: scriptRoutes.length > 0 ? scriptRoutes : undefined,
        };
      }

      if (node.type === "condition") {
        interface ConditionRoute {
          when?: any;
          goto?: string;
          gotoId?: string;
        }
        interface ConditionNext {
          routes?: ConditionRoute[];
          default?: string;
          defaultId?: string;
        }
        const nextNode = data.nextNode as ConditionNext;
        const routesRaw = nextNode?.routes || [];

        const routes = routesRaw.map((route) => {
          const target = resolveTarget(route.gotoId || route.goto || "");
          const executableTarget = resolveExecutableTarget(nodes, flowName, target);
          return {
            when: route.when,
            goto: executableTarget.nodeId || target.id || "",
            gotoId: executableTarget.nodeId || target.id || "",
            gotoFlow: executableTarget.flowName,
          };
        });

        const defaultTarget = resolveTarget(nextNode?.defaultId || nextNode?.default || "");
        const defaultExecutableTarget = resolveExecutableTarget(nodes, flowName, defaultTarget);

        return {
          ...base,
          nextNode: {
            routes,
            default: defaultExecutableTarget.nodeId || defaultTarget.id || "",
            defaultId: defaultExecutableTarget.nodeId || defaultTarget.id || "",
            defaultFlow: defaultExecutableTarget.flowName,
          },
        };
      }

      if (node.type === "router") {
        interface RouterRoute {
          when?: Record<string, unknown>;
          goto?: string;
          gotoId?: string;
          toMainMenu?: boolean;
          isGoBack?: boolean;
          goBackTarget?: string;
          goBackTargetId?: string;
          goBackToFlow?: string;
        }
        interface RouterNext {
          routes?: RouterRoute[];
          default?: string;
          defaultId?: string;
        }

        const nextNodeRaw = data.nextNode;
        const nextNode =
          nextNodeRaw && typeof nextNodeRaw === "object"
            ? (nextNodeRaw as RouterNext)
            : undefined;
        const routesRaw = nextNode?.routes || [];
        const responseMappingRaw =
          (data.responseMapping as Record<string, unknown>) || {};
        const responseMapping = Object.fromEntries(
          Object.entries(responseMappingRaw)
            .filter(([key]) => key.trim().length > 0)
            .map(([key, value]) => [key, String(value ?? "")])
        );

        const routes: FlowRoute[] = routesRaw.map((route) => {
          if (route.toMainMenu) {
            return {
              when: route.when,
              toMainMenu: true,
            };
          }

          if (route.isGoBack) {
            const routeObj: FlowRoute = {
              when: route.when,
              isGoBack: true,
              goBackTarget: route.goBackTargetId || route.goBackTarget || "",
              goBackTargetId: route.goBackTargetId || route.goBackTarget || "",
            };
            if (route.goBackToFlow && route.goBackToFlow !== flowName) {
              routeObj.goBackToFlow = route.goBackToFlow;
            }
            return routeObj;
          }

          const target = resolveTarget(route.gotoId || route.goto || "");
          const executableTarget = resolveExecutableTarget(nodes, flowName, target);
          return {
            when: route.when,
            goto: executableTarget.nodeId || target.id || "",
            gotoId: executableTarget.nodeId || target.id || "",
            gotoFlow: executableTarget.flowName,
          };
        });

        const defaultTarget =
          typeof nextNodeRaw === "string"
            ? resolveTarget(nextNodeRaw)
            : resolveTarget(nextNode?.defaultId || nextNode?.default || "");
        const defaultExecutableTarget = resolveExecutableTarget(nodes, flowName, defaultTarget);

        return {
          ...base,
          url: String(data.url ?? ""),
          method: String(data.method ?? "POST"),
          sessionMode:
            data.sessionMode === "required" ||
            data.sessionMode === "optional" ||
            data.sessionMode === "disabled"
              ? data.sessionMode
              : undefined,
          responseMapping:
            Object.keys(responseMapping).length > 0
              ? responseMapping
              : undefined,
          persistResponseMappingKeys: Array.isArray(data.persistResponseMappingKeys)
            ? (data.persistResponseMappingKeys as unknown[])
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
            : undefined,
          maskedResponseMappingKeys: Array.isArray(data.maskedResponseMappingKeys)
            ? (data.maskedResponseMappingKeys as unknown[])
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
            : undefined,
          inputManagerSaveSessionId: String(data.inputManagerSaveSessionId ?? "") || undefined,
          nextNode: {
            routes,
            default: defaultExecutableTarget.nodeId || defaultTarget.id || "",
            defaultId: defaultExecutableTarget.nodeId || defaultTarget.id || "",
            defaultFlow: defaultExecutableTarget.flowName,
          },
        };
      }

      return base;
    });

  return {
    flowName,
    entryNode: executableEntryTarget.nodeId || entryResolved.id,
    entryNodeId: executableEntryTarget.nodeId || entryResolved.id,
    nodes: flowNodes,
    visualState: { nodes: sanitizedVisualNodes, edges },
  };
};

