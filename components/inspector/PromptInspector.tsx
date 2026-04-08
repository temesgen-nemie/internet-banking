import { useEffect, useMemo, useState } from "react";
import NodeNameInput from "./NodeNameInput";
import TargetNodeDisplay from "./TargetNodeDisplay";
import { useFlowStore } from "../../store/flow/flowStore";

type PromptInspectorProps = {
  node: PromptNode;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

type PromptRoute = {
  when?: { eq?: string[] };
  gotoFlow?: string;
  isGoBack?: boolean;
  toMainMenu?: boolean;
  goBackTarget?: string;
  goBackToFlow?: string;
};

type PromptNextNode = {
  routes?: PromptRoute[];
  default?: string;
};

type PromptNodeData = {
  name?: string;
  message?: string;
  responseFormat?: "json" | "soap";
  responseBodyMapping?: Record<string, unknown>;
  responseBodyRaw?: string;
  responseHeaders?: Record<string, unknown>;
  responseStatusCode?: number;
  inputType?: "NON_ZERO_FLOAT" | "NON_ZERO_INT" | "FLOAT" | "INTEGER" | "STRING";
  invalidInputTypeMessage?: string;
  inputValidationEnabled?: boolean;
  nextNode?: PromptNextNode | string;
  persistByIndex?: boolean;
  persistByIndexValue?: string;
  persistSourceField?: string;
  persistFieldName?: string;
  validateIndexedList?: boolean;
  indexedListVar?: string;
  invalidInputMessage?: string;
  emptyInputMessage?: string;
  persistInput?: boolean;
  persistInputAs?: string;
  responseType?: "CONTINUE" | "END";
  encryptInput?: boolean;
  isMainMenu?: boolean;
};

type PromptNode = {
  id: string;
  parentNode?: string;
  data: PromptNodeData;
};

const stringifyPromptResponseBody = (node: PromptNode): string => {
  if (node.data.responseFormat === "soap") {
    return String(node.data.responseBodyRaw ?? node.data.message ?? "");
  }
  const responseBody = node.data.responseBodyMapping;
  if (responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)) {
    return JSON.stringify(responseBody, null, 2);
  }

  const rawMessage = String(node.data.message ?? "").trim();
  if ((rawMessage.startsWith("{") && rawMessage.endsWith("}")) || (rawMessage.startsWith("[") && rawMessage.endsWith("]"))) {
    return rawMessage;
  }

  return JSON.stringify(
    {
      message: String(node.data.message ?? ""),
    },
    null,
    2
  );
};

export default function PromptInspector({ node, updateNodeData }: PromptInspectorProps) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [activeFlowSearchIdx, setActiveFlowSearchIdx] = useState<number | null>(null);
  const [responseBodyText, setResponseBodyText] = useState(() => stringifyPromptResponseBody(node));
  const [responseBodyError, setResponseBodyError] = useState<string | null>(null);
  const [responseStatusCodeText, setResponseStatusCodeText] = useState(() => String(node.data.responseStatusCode ?? 200));

  useEffect(() => {
    setResponseBodyText(stringifyPromptResponseBody(node));
    setResponseBodyError(null);
    setResponseStatusCodeText(String(node.data.responseStatusCode ?? 200));
  }, [node]);

  // Find siblings: nodes in the same parent group or at root
  const siblings = nodes.filter(
    (n) =>
      n.parentNode === node.parentNode &&
      n.id !== node.id &&
      n.type !== "group" &&
      n.type !== "start"
  );
  const siblingNames = siblings.map((n) => (n.data as any).name || "").filter(Boolean);

  const variableScope = useMemo(() => {
    const findOutermostParent = (nodeId: string): string | null => {
      let current = nodes.find((n) => n.id === nodeId);
      let outermost: string | null = null;
      while (current?.parentNode) {
        outermost = current.parentNode;
        current = nodes.find((n) => n.id === current?.parentNode);
      }
      return outermost;
    };

    const currentOutermost = findOutermostParent(node.id);
    const flowNodes = nodes.filter((n) => {
      if (currentOutermost) {
        return findOutermostParent(n.id) === currentOutermost || n.id === currentOutermost;
      }
      return !n.parentNode;
    });
    const flowNodeIds = new Set(flowNodes.map((n) => n.id));

    const persisted = new Set<string>();
    flowNodes.forEach((n) => {
      if (n.type === "prompt") {
        const promptData = (n.data as Record<string, unknown>) || {};
        if (promptData.persistInput && promptData.persistInputAs) {
          persisted.add(String(promptData.persistInputAs).trim());
        }
        if (promptData.persistByIndex && promptData.persistFieldName) {
          persisted.add(String(promptData.persistFieldName).trim());
        }
      }
      if (n.type === "action") {
        const actionData = (n.data as Record<string, unknown>) || {};
        const persistKeys = Array.isArray(actionData.persistResponseMappingKeys)
          ? (actionData.persistResponseMappingKeys as string[])
          : [];
        persistKeys
          .map((key) => String(key ?? "").trim())
          .filter(Boolean)
          .forEach((key) => persisted.add(key));
      }
    });

    const immediate = new Set<string>();
    const incomingActionIds = edges
      .filter((edge) => edge.target === node.id && flowNodeIds.has(edge.source))
      .map((edge) => edge.source);

    incomingActionIds.forEach((actionId) => {
      const source = nodes.find((n) => n.id === actionId);
      if (!source || source.type !== "action") return;
      const actionData = (source.data as Record<string, unknown>) || {};
      const mapping = (actionData.responseMapping as Record<string, unknown>) || {};
      const allKeys = Object.keys(mapping)
        .map((key) => key.trim())
        .filter(Boolean);
      const persistedKeys = new Set(
        (Array.isArray(actionData.persistResponseMappingKeys)
          ? actionData.persistResponseMappingKeys
          : []
        )
          .map((key) => String(key ?? "").trim())
          .filter(Boolean)
      );
      allKeys.filter((key) => !persistedKeys.has(key)).forEach((key) => immediate.add(key));
    });

    const available = new Set<string>([...persisted, ...immediate]);
    return {
      immediate: Array.from(immediate).sort(),
      persisted: Array.from(persisted).sort(),
      available,
    };
  }, [edges, node.id, nodes]);

  const messageVariableDiagnostics = useMemo(() => {
    const text = String(node.data.message ?? "");
    const re = /{{\s*vars\.([^}\s]+)\s*}}/g;
    const seen = new Set<string>();
    const used: string[] = [];
    let match: RegExpExecArray | null = re.exec(text);
    while (match) {
      const key = String(match[1] ?? "").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        used.push(key);
      }
      match = re.exec(text);
    }
    const invalid = used.filter((key) => !variableScope.available.has(key));
    return { used, invalid };
  }, [node.data.message, variableScope.available]);

  const rootFlowName = useMemo(() => {
    const rootStart = nodes.find((n) => !n.parentNode && n.type === "start");
    return (rootStart?.data as any)?.flowName || "Root Flow";
  }, [nodes]);

  const ancestorFlows = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    let tempParentId = node.parentNode;

    while (tempParentId) {
      const parentGroup = nodes.find((n) => n.id === tempParentId);
      if (!parentGroup) break;

      const name =
        (parentGroup.data as any).name || (parentGroup.data as any).flowName || "Unnamed Flow";
      list.push({ id: parentGroup.id, name });

      tempParentId = parentGroup.parentNode;
    }

    return list;
  }, [node.parentNode, nodes]);

  const allFlowNames = useMemo(() => {
    return Array.from(new Set(ancestorFlows.map((f) => f.name)));
  }, [ancestorFlows]);

  const currentFlowName = useMemo(() => {
    const parentId = node.parentNode;
    if (!parentId) return rootFlowName;

    // Check if parent group has a name
    const parentGroup = nodes.find((n) => n.id === parentId);
    if (parentGroup && ((parentGroup.data as any).name || (parentGroup.data as any).flowName)) {
      return (parentGroup.data as any).name || (parentGroup.data as any).flowName;
    }

    // Check for start node in the same group
    const startNode = nodes.find((n) => n.parentNode === parentId && n.type === "start");
    return (startNode?.data?.flowName as string) || "Unnamed Flow";
  }, [node.parentNode, nodes, rootFlowName]);

  const isMenuMode =
    !!node.data.nextNode &&
    typeof node.data.nextNode === "object" &&
    Array.isArray((node.data.nextNode as PromptNextNode).routes);

  const syncMessage = (currentMessage: string, routes: PromptRoute[]): string => {
    const lines = currentMessage.split("\n");
    const introLines: string[] = [];

    const routeInputs = new Set(routes.map((r) => r.when?.eq?.[1]).filter((v): v is string => !!v));

    const routeEndpoints = new Set(
      routes.map((r) => (r.gotoFlow || "").trim().toLowerCase()).filter(Boolean)
    );

    for (const line of lines) {
      const trimmed = line.trim();
      const trimmedLower = trimmed.toLowerCase();
      const firstWord = trimmed.split(/[\s\.]/, 1)[0];

      const isInputPrefix = /^[\d*#]+([\.\s]|$)/.test(trimmed);
      const isInputMatch = routeInputs.has(firstWord) || routeInputs.has(trimmed);

      const containsGoBack = trimmedLower.endsWith("go back");
      const containsMainMenu = trimmedLower.endsWith("main menu");

      // Check if line exactly matches or is a prefix of a known route target (e.g. "bal" vs "balance")
      // This prevents "spiral" duplication when typing a target name before an input
      const matchesTarget =
        routeEndpoints.has(trimmedLower) ||
        Array.from(routeEndpoints).some(
          (target) => target.startsWith(trimmedLower) || trimmedLower.startsWith(target)
        );

      if (isInputPrefix || isInputMatch || containsGoBack || containsMainMenu || matchesTarget) {
        break;
      }

      const isSeparatorOnly = /^[.\-\s]+$/.test(trimmed);
      if (isSeparatorOnly && introLines.length > 0) {
        break;
      }

      introLines.push(line);
    }

    const intro = introLines.join("\n").trim();

    const routingLines = routes
      .map((r) => {
        const input = (r.when?.eq?.[1] || "").trim();
        const isGoBack = r.isGoBack;
        const isMainMenu = (r as any).toMainMenu || (r as any).isMainMenu;
        let name = (r.gotoFlow || "").trim();

        // If it's a special route but has no custom name yet, use default fallbacks
        if (!name) {
          if (isGoBack) name = "Go Back";
          else if (isMainMenu) name = "Main Menu";
        }

        if (input && name) return `${input}. ${name}`;
        if (input) return `${input}.`;
        return name;
      })
      .filter((s) => !!s);

    return intro ? `${intro}\n\n${routingLines.join("\n")}` : routingLines.join("\n");
  };

  const handleResponseBodyChange = (nextValue: string) => {
    setResponseBodyText(nextValue);
    if (node.data.responseFormat === "soap") {
      setResponseBodyError(null);
      updateNodeData(node.id, {
        responseBodyRaw: nextValue,
      });
      return;
    }
    try {
      const parsed = JSON.parse(nextValue) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setResponseBodyError("Response JSON must be an object.");
        return;
      }

      setResponseBodyError(null);
      const nextData: Partial<Record<string, unknown>> = {
        responseBodyMapping: parsed as Record<string, unknown>,
      };
      if (typeof (parsed as Record<string, unknown>).message === "string") {
        nextData.message = String((parsed as Record<string, unknown>).message);
      }
      updateNodeData(node.id, nextData);
    } catch (error) {
      setResponseBodyError(error instanceof Error ? error.message : "Invalid JSON");
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left Column: Basic Info + Routing */}
      <div className="space-y-4">
        <NodeNameInput
          nodeId={node.id}
          name={String(node.data.name ?? "")}
          onNameChange={(val) => updateNodeData(node.id, { name: val })}
        />

        <div>
          <label className="text-xs font-medium text-gray-600">
            {node.data.responseFormat === "soap" ? "Response SOAP/XML" : "Response JSON"}
          </label>
          <textarea
            className="mt-2 w-full rounded-md border border-gray-100 p-2 bg-white shadow-sm placeholder-gray-400 text-gray-900"
            value={responseBodyText}
            rows={10}
            placeholder={
              node.data.responseFormat === "soap"
                ? "<cps-message>\n  <sequence_number>1</sequence_number>\n  <msg_content>{{vars.message}}</msg_content>\n</cps-message>"
                : '{\n  "message": "utilities ok t"\n}'
            }
            onChange={(e) => handleResponseBodyChange(e.target.value)}
          />
          {responseBodyError && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              {responseBodyError}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Fallback Message</label>
          <textarea
            className="mt-2 w-full rounded-md border border-gray-100 p-2 bg-white shadow-sm placeholder-gray-400 text-gray-900"
            value={node.data.message || ""}
            rows={3}
            placeholder="Enter fallback message..."
            onChange={(e) => updateNodeData(node.id, { message: e.target.value })}
          />
          <div className="mt-2 space-y-2 rounded-md border border-gray-100 bg-gray-50 p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Available Vars
            </div>
            {variableScope.immediate.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-indigo-600 font-medium">Immediate Next Only</div>
                <div className="flex flex-wrap gap-1.5">
                  {variableScope.immediate.map((key) => {
                    const token = `{{vars.${key}}}`;
                    return (
                      <button
                        key={`imm-${key}`}
                        type="button"
                        className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100"
                        onClick={() =>
                          updateNodeData(node.id, {
                            message:
                              `${String(node.data.message ?? "")}${String(node.data.message ?? "").endsWith(" ") ? "" : " "}${token}`.trim(),
                          })
                        }
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {variableScope.persisted.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-emerald-600 font-medium">
                  Persisted (Flow-wide)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variableScope.persisted.map((key) => {
                    const token = `{{vars.${key}}}`;
                    return (
                      <button
                        key={`persist-${key}`}
                        type="button"
                        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-100"
                        onClick={() =>
                          updateNodeData(node.id, {
                            message:
                              `${String(node.data.message ?? "")}${String(node.data.message ?? "").endsWith(" ") ? "" : " "}${token}`.trim(),
                          })
                        }
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {variableScope.immediate.length === 0 && variableScope.persisted.length === 0 && (
              <div className="text-xs text-gray-400">No vars available for this node yet.</div>
            )}
            {messageVariableDiagnostics.invalid.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                Invalid/out-of-scope vars for this node:{" "}
                {messageVariableDiagnostics.invalid.map((key) => `{{vars.${key}}}`).join(", ")}
              </div>
            )}
          </div>
        </div>

        {isMenuMode && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Routing Rules</label>
              <button
                onClick={() => {
                  let currentNextNode = node.data.nextNode;
                  if (typeof currentNextNode !== "object" || !currentNextNode) {
                    currentNextNode = { routes: [], default: "" };
                  }

                  const routes = currentNextNode.routes || [];
                  const newRoutes = [...routes, { when: { eq: ["{{input}}", ""] }, gotoFlow: "" }];

                  const newMessage = syncMessage(node.data.message || "", newRoutes);

                  updateNodeData(node.id, {
                    message: newMessage,
                    nextNode: {
                      ...currentNextNode,
                      routes: newRoutes,
                    },
                  });
                }}
                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100"
              >
                + Add Rule
              </button>
            </div>

            <div className="space-y-3 pr-1 max-h-[500px] overflow-y-auto overflow-x-hidden">
              {(() => {
                const nextNode = node.data.nextNode;
                const routes =
                  nextNode && typeof nextNode === "object" && nextNode.routes
                    ? nextNode.routes
                    : [];

                return routes.map((route, idx) => {
                  const inputValue = route.when?.eq?.[1] || "";
                  const gotoFlow = (route as any).gotoFlow || (route as any).goto || "";
                  const isGoBack = (route as any).isGoBack || false;
                  const isToMainMenu =
                    (route as any).toMainMenu || (route as any).isMainMenu || false;
                  const goBackTarget = (route as any).goBackTarget || "";
                  return (
                    <div
                      key={idx}
                      className="group relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-visible"
                    >
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={() => {
                            const nextNode = node.data.nextNode as PromptNextNode;
                            const newRoutes = (nextNode.routes || []).filter((_, i) => i !== idx);
                            const newMessage = syncMessage(node.data.message || "", newRoutes);
                            updateNodeData(node.id, {
                              message: newMessage,
                              nextNode: { ...nextNode, routes: newRoutes },
                            });
                          }}
                          className="bg-white text-gray-400 hover:text-red-500 p-1.5 rounded-full shadow-lg border border-gray-100 transition-colors"
                          title="Remove Rule"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="w-1/4">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                              <svg
                                className="w-3 h-3 text-indigo-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                                />
                              </svg>
                              Input
                            </label>
                            <input
                              className="w-full text-sm border-b-2 border-gray-100 bg-transparent py-1.5 focus:outline-none focus:border-indigo-500 placeholder-gray-300 font-mono text-center text-gray-900 transition-colors"
                              value={inputValue}
                              onChange={(e) => {
                                const nextNode = node.data.nextNode as PromptNextNode;
                                const newRoutes = [...(nextNode.routes || [])];
                                newRoutes[idx] = {
                                  ...newRoutes[idx],
                                  when: { eq: ["{{input}}", e.target.value] },
                                };
                                const newMessage = syncMessage(node.data.message || "", newRoutes);
                                updateNodeData(node.id, {
                                  message: newMessage,
                                  nextNode: { ...nextNode, routes: newRoutes },
                                });
                              }}
                              placeholder="1"
                            />
                          </div>

                          <div className="flex-1">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                              <svg
                                className={`w-3 h-3 ${isGoBack ? "text-amber-500" : isToMainMenu ? "text-indigo-500" : "text-indigo-400"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                                />
                              </svg>
                              {isGoBack
                                ? "Go Back Label"
                                : isToMainMenu
                                  ? "Main Menu Label"
                                  : "Goto Flow/Node"}
                            </label>
                            <input
                              className="w-full text-sm border-b-2 border-gray-100 bg-transparent py-1.5 focus:outline-none focus:border-indigo-500 placeholder-gray-300 text-gray-900 transition-colors"
                              value={gotoFlow}
                              onChange={(e) => {
                                const nextNode = node.data.nextNode as PromptNextNode;
                                const newRoutes = [...(nextNode.routes || [])];
                                newRoutes[idx] = {
                                  ...newRoutes[idx],
                                  gotoFlow: e.target.value,
                                };
                                const newMessage = syncMessage(node.data.message || "", newRoutes);
                                updateNodeData(node.id, {
                                  message: newMessage,
                                  nextNode: { ...nextNode, routes: newRoutes },
                                });
                              }}
                              placeholder={
                                isGoBack ? "Go Back" : isToMainMenu ? "Main Menu" : "Target Name"
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 py-1 bg-gray-50/50 rounded-lg px-2 border border-gray-50">
                          <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 cursor-pointer group/label">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={isGoBack}
                                onChange={(e) => {
                                  const nextNode = node.data.nextNode as PromptNextNode;
                                  const newRoutes = [...(nextNode.routes || [])];
                                  newRoutes[idx] = {
                                    ...newRoutes[idx],
                                    isGoBack: e.target.checked,
                                    toMainMenu: e.target.checked
                                      ? false
                                      : (newRoutes[idx] as any).toMainMenu,
                                    when: e.target.checked
                                      ? { eq: ["{{input}}", "*"] }
                                      : newRoutes[idx].when,
                                  };
                                  const newMessage = syncMessage(
                                    node.data.message || "",
                                    newRoutes
                                  );
                                  updateNodeData(node.id, {
                                    message: newMessage,
                                    nextNode: {
                                      ...nextNode,
                                      routes: newRoutes,
                                    },
                                  });
                                }}
                                className="peer h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all appearance-none border-2 checked:bg-indigo-600 checked:border-indigo-600"
                              />
                              <svg
                                className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none left-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                            <span>To Go Back</span>
                          </label>

                          <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 cursor-pointer group/label">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={isToMainMenu}
                                onChange={(e) => {
                                  const nextNode = node.data.nextNode as PromptNextNode;
                                  const newRoutes = [...(nextNode.routes || [])];
                                  newRoutes[idx] = {
                                    ...newRoutes[idx],
                                    toMainMenu: e.target.checked,
                                    isGoBack: e.target.checked ? false : newRoutes[idx].isGoBack,
                                    when: e.target.checked
                                      ? { eq: ["{{input}}", "**"] }
                                      : newRoutes[idx].when,
                                  };
                                  const newMessage = syncMessage(
                                    node.data.message || "",
                                    newRoutes
                                  );
                                  updateNodeData(node.id, {
                                    message: newMessage,
                                    nextNode: {
                                      ...nextNode,
                                      routes: newRoutes,
                                    },
                                  });
                                }}
                                className="peer h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all appearance-none border-2 checked:bg-indigo-600 checked:border-indigo-600"
                              />
                              <svg
                                className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none left-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                            <span>To Main Menu</span>
                          </label>
                        </div>

                        {isGoBack && (
                          <div className="space-y-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Go Back Target */}
                              <div className="relative">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                  <svg
                                    className="w-3 h-3 text-amber-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                    />
                                  </svg>
                                  Go Back Target
                                </label>

                                <div className="relative">
                                  <div className="relative group/input">
                                    <input
                                      className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/30 px-3 py-2 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder-gray-300 text-gray-900 pr-10"
                                      value={goBackTarget}
                                      onFocus={() => setActiveSearchIdx(idx)}
                                      onClick={() => setActiveSearchIdx(idx)}
                                      onBlur={() => setTimeout(() => setActiveSearchIdx(null), 200)}
                                      onChange={(e) => {
                                        const nextNode = node.data.nextNode as PromptNextNode;
                                        const newRoutes = [...(nextNode.routes || [])];
                                        newRoutes[idx] = {
                                          ...newRoutes[idx],
                                          goBackTarget: e.target.value,
                                        };
                                        updateNodeData(node.id, {
                                          nextNode: { ...nextNode, routes: newRoutes },
                                        });
                                      }}
                                      placeholder="e.g. Settings"
                                    />
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveSearchIdx(activeSearchIdx === idx ? null : idx);
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-4 w-4 transition-transform duration-200 ${activeSearchIdx === idx ? "rotate-180" : ""}`}
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                  {activeSearchIdx === idx && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-[9999] max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                      {(() => {
                                        const flowToSearch = route.goBackToFlow || currentFlowName;
                                        let targetNodes: string[] = [];

                                        if (flowToSearch === rootFlowName) {
                                          targetNodes = nodes
                                            .filter(
                                              (n) =>
                                                !n.parentNode &&
                                                n.type !== "start" &&
                                                n.type !== "group"
                                            )
                                            .map((n) => (n.data as any).name || "")
                                            .filter(Boolean)
                                            .sort((a, b) => a.localeCompare(b));
                                        } else if (flowToSearch === currentFlowName) {
                                          targetNodes = nodes
                                            .filter(
                                              (n) =>
                                                n.parentNode === node.parentNode &&
                                                n.type !== "start" &&
                                                n.type !== "group"
                                            )
                                            .map((n) => (n.data as any).name || "")
                                            .filter(Boolean)
                                            .sort((a, b) => a.localeCompare(b));
                                        } else {
                                          // Find the specific ancestor group with this name
                                          const targetAncestor = ancestorFlows.find(
                                            (f) => f.name === flowToSearch
                                          );

                                          if (targetAncestor) {
                                            targetNodes = nodes
                                              .filter(
                                                (n) =>
                                                  n.parentNode === targetAncestor.id &&
                                                  n.type !== "start" &&
                                                  n.type !== "group"
                                              )
                                              .map((n) => (n.data as any).name || "")
                                              .filter(Boolean)
                                              .sort((a, b) => a.localeCompare(b));
                                          } else {
                                            const targetFlowGroup = nodes.find((n) => {
                                              if (n.type !== "group") return false;
                                              const gName =
                                                (n.data as any).name || (n.data as any).flowName;
                                              if (gName === flowToSearch) return true;
                                              const start = nodes.find(
                                                (s) => s.parentNode === n.id && s.type === "start"
                                              );
                                              return (
                                                (start?.data as any)?.flowName === flowToSearch
                                              );
                                            });

                                            if (targetFlowGroup) {
                                              targetNodes = nodes
                                                .filter(
                                                  (n) =>
                                                    n.parentNode === targetFlowGroup.id &&
                                                    n.type !== "start" &&
                                                    n.type !== "group"
                                                )
                                                .map((n) => (n.data as any).name || "")
                                                .filter(Boolean)
                                                .sort((a, b) => a.localeCompare(b));
                                            }
                                          }
                                        }

                                        const isExactTargetMatch = targetNodes.includes(
                                          goBackTarget || ""
                                        );
                                        const filtered =
                                          isExactTargetMatch || !goBackTarget
                                            ? targetNodes
                                            : targetNodes.filter((name) =>
                                                name
                                                  .toLowerCase()
                                                  .includes((goBackTarget || "").toLowerCase())
                                              );

                                        if (filtered.length === 0) {
                                          return (
                                            <div className="px-4 py-3 text-xs text-gray-400 italic">
                                              No nodes found in {flowToSearch}
                                            </div>
                                          );
                                        }

                                        return filtered.map((name) => (
                                          <button
                                            key={name}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              const nextNode = node.data.nextNode as PromptNextNode;
                                              const newRoutes = [...(nextNode.routes || [])];
                                              newRoutes[idx] = {
                                                ...newRoutes[idx],
                                                goBackTarget: name,
                                              };
                                              updateNodeData(node.id, {
                                                nextNode: { ...nextNode, routes: newRoutes },
                                              });
                                              setActiveSearchIdx(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors border-b border-gray-50 last:border-0 ${
                                              name === (goBackTarget || "")
                                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                                : "text-gray-900 hover:bg-indigo-600 hover:text-white"
                                            }`}
                                          >
                                            {name}
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Go Back To Flow */}
                              <div className="relative">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                  <svg
                                    className="w-3 h-3 text-indigo-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  Flow Name
                                </label>

                                <div className="relative">
                                  <div className="relative group/input">
                                    <input
                                      className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/30 px-3 py-2 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder-gray-400 text-gray-900 pr-10"
                                      value={route.goBackToFlow || ""}
                                      onFocus={() => setActiveFlowSearchIdx(idx)}
                                      onClick={() => setActiveFlowSearchIdx(idx)}
                                      onBlur={() =>
                                        setTimeout(() => setActiveFlowSearchIdx(null), 200)
                                      }
                                      onChange={(e) => {
                                        const nextNode = node.data.nextNode as PromptNextNode;
                                        const newRoutes = [...(nextNode.routes || [])];
                                        newRoutes[idx] = {
                                          ...newRoutes[idx],
                                          goBackToFlow: e.target.value,
                                          goBackTarget: "",
                                        };
                                        updateNodeData(node.id, {
                                          nextNode: { ...nextNode, routes: newRoutes },
                                        });
                                      }}
                                      placeholder={currentFlowName || "Current Flow"}
                                    />
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveFlowSearchIdx(
                                          activeFlowSearchIdx === idx ? null : idx
                                        );
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-4 w-4 transition-transform duration-200 ${activeFlowSearchIdx === idx ? "rotate-180" : ""}`}
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                  {activeFlowSearchIdx === idx && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-9999 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                      {/* Clear / Current Flow Option */}
                                      <button
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const nextNode = node.data.nextNode as PromptNextNode;
                                          const newRoutes = [...(nextNode.routes || [])];
                                          newRoutes[idx] = {
                                            ...newRoutes[idx],
                                            goBackToFlow: "",
                                            goBackTarget: "",
                                          };
                                          updateNodeData(node.id, {
                                            nextNode: { ...nextNode, routes: newRoutes },
                                          });
                                          setActiveFlowSearchIdx(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-medium border-b border-gray-50"
                                      >
                                        Revert to Current Flow
                                      </button>
                                      {(() => {
                                        const sortedAllFlowNames = [...allFlowNames].sort((a, b) =>
                                          a.localeCompare(b)
                                        ); // Added sort
                                        const isExactFlowMatch = sortedAllFlowNames.includes(
                                          route.goBackToFlow || ""
                                        );
                                        const filtered =
                                          isExactFlowMatch || !route.goBackToFlow
                                            ? sortedAllFlowNames
                                            : sortedAllFlowNames.filter((name) =>
                                                name
                                                  .toLowerCase()
                                                  .includes(
                                                    (route.goBackToFlow || "").toLowerCase()
                                                  )
                                              );

                                        if (
                                          filtered.length === 0 &&
                                          (route.goBackToFlow || "").length > 0
                                        ) {
                                          return (
                                            <div className="px-4 py-3 text-xs text-gray-400 italic">
                                              No flows matching &quot;{route.goBackToFlow || ""}
                                              &quot;
                                            </div>
                                          );
                                        }

                                        return filtered.map((name) => (
                                          <button
                                            key={name}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              const nextNode = node.data.nextNode as PromptNextNode;
                                              const newRoutes = [...(nextNode.routes || [])];
                                              newRoutes[idx] = {
                                                ...newRoutes[idx],
                                                goBackToFlow: name,
                                                goBackTarget: "",
                                              };
                                              updateNodeData(node.id, {
                                                nextNode: { ...nextNode, routes: newRoutes },
                                              });
                                              setActiveFlowSearchIdx(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors border-b border-gray-50 last:border-0 ${
                                              name === (route.goBackToFlow || "")
                                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                                : "text-gray-900 hover:bg-indigo-600 hover:text-white"
                                            }`}
                                          >
                                            {name === currentFlowName ? `${name} (Current)` : name}
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {isToMainMenu && (
                          <div className="pt-2 border-t border-gray-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                />
                              </svg>
                              <span className="text-[11px] font-semibold tracking-tight uppercase">
                                Redirects to Main Menu
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}

              <div className="mt-4 pt-3 border-t border-gray-200">
                <TargetNodeDisplay
                  nodeId={
                    node.data.nextNode && typeof node.data.nextNode === "object"
                      ? (node.data.nextNode as any).default || ""
                      : (node.data.nextNode as string) || ""
                  }
                  label="Default (Fallback)"
                  placeholder="Connect fallback on canvas"
                />
              </div>
            </div>
          </div>
        )}

        {!isMenuMode && (
          <TargetNodeDisplay
            nodeId={node.data.nextNode as string}
            label="Next Node"
            title="Connect the Prompt Node bottom handle on the canvas"
          />
        )}
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-50 mb-2">
            <svg
              className="w-4 h-4 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.717 1.717 0 01-1.07 1.703c-1.624.812-1.624 3.124 0 3.936a1.717 1.717 0 011.07 1.703c-.426 1.756-2.924 1.756-3.35 0a1.717 1.717 0 011.07-1.703c1.624-.812 1.624-3.124 0-3.936a1.717 1.717 0 01-1.07-1.703z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              General Settings
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/*
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1.5 block">
                Response Type
              </label>
              <select
                className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-gray-900"
                value={node.data.responseType ?? "CONTINUE"}
                onChange={(e) => updateNodeData(node.id, { responseType: e.target.value })}
              >
                <option value="CONTINUE">CONTINUE</option>
                <option value="END">END</option>
              </select>
            </div>
            */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1.5 block">
                Response Format
              </label>
              <select
                className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-gray-900"
                value={node.data.responseFormat ?? "json"}
                onChange={(e) => {
                  const nextFormat = e.target.value as "json" | "soap";
                  const nextData: Partial<Record<string, unknown>> = {
                    responseFormat: nextFormat,
                  };
                  if (nextFormat === "soap") {
                    nextData.responseBodyRaw = String(node.data.responseBodyRaw ?? responseBodyText ?? "");
                    nextData.responseHeaders = {
                      ...(typeof node.data.responseHeaders === "object" && node.data.responseHeaders
                        ? (node.data.responseHeaders as Record<string, unknown>)
                        : {}),
                      "Content-Type": "text/xml; charset=utf-8",
                    };
                  }
                  updateNodeData(node.id, nextData);
                }}
              >
                <option value="json">JSON</option>
                <option value="soap">SOAP/XML</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1.5 block">
                Response Status Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-gray-900"
                value={responseStatusCodeText}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "");
                  setResponseStatusCodeText(digitsOnly);
                }}
                onBlur={() => {
                  const parsed = Number.parseInt(responseStatusCodeText, 10);
                  const nextValue = Number.isFinite(parsed) ? Math.min(599, Math.max(100, parsed)) : 200;
                  setResponseStatusCodeText(String(nextValue));
                  updateNodeData(node.id, { responseStatusCode: nextValue });
                }}
              />
              <div className="mt-1 text-[10px] text-gray-400">
                Used when this prompt returns an HTTP response body.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.data.encryptInput)}
                onChange={(e) => updateNodeData(node.id, { encryptInput: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all border-2 checked:bg-indigo-600"
              />
              <span>Encrypt Input</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.data.isMainMenu)}
                onChange={(e) => updateNodeData(node.id, { isMainMenu: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all border-2 checked:bg-indigo-600"
              />
              <span>Is Main Menu</span>
            </label>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-50 mb-2">
            <svg
              className="w-4 h-4 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              Input Validation & Persistence
            </h3>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.data.persistByIndex)}
                disabled={Boolean(node.data.persistInput)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateNodeData(node.id, {
                    persistByIndex: checked,
                    ...(checked ? {} : { persistByIndexValue: "" }),
                  });
                }}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-all border-2 checked:bg-emerald-600 disabled:opacity-40"
              />
              <span className={node.data.persistInput ? "opacity-40" : ""}>Persist By Index</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.data.persistInput)}
                disabled={Boolean(node.data.persistByIndex)}
                onChange={(e) => updateNodeData(node.id, { persistInput: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-all border-2 checked:bg-emerald-600 disabled:opacity-40"
              />
              <span className={node.data.persistByIndex ? "opacity-40" : ""}>Persist Input</span>
            </label>
          </div>

          {(node.data.persistByIndex || node.data.persistInput) && (
            <div className="pt-3 space-y-3 animate-in fade-in slide-in-from-top-2">
              {node.data.persistByIndex && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                        Persist Source Field
                      </label>
                      <input
                        className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-2 py-1.5 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all text-gray-900"
                        value={String(node.data.persistSourceField ?? "")}
                        onChange={(e) =>
                          updateNodeData(node.id, { persistSourceField: e.target.value })
                        }
                        placeholder="userAccounts"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                        Persist Field Name
                      </label>
                      <input
                        className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-2 py-1.5 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all text-gray-900"
                        value={String(node.data.persistFieldName ?? "")}
                        onChange={(e) =>
                          updateNodeData(node.id, { persistFieldName: e.target.value })
                        }
                        placeholder="SelectedAccount"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={String(node.data.persistByIndexValue ?? "") === "object"}
                      onChange={(e) =>
                        updateNodeData(node.id, {
                          persistByIndexValue: e.target.checked ? "object" : "",
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-all border-2 checked:bg-emerald-600"
                    />
                    <span>Persist By Index Value</span>
                  </label>
                </div>
              )}
              {node.data.persistInput && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Persist Input As
                  </label>
                  <input
                    className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all text-gray-900"
                    value={String(node.data.persistInputAs ?? "")}
                    onChange={(e) => updateNodeData(node.id, { persistInputAs: e.target.value })}
                    placeholder="receiverAccountNumber"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-50 mb-2">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Index Validation
              </h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.data.validateIndexedList)}
                onChange={(e) => updateNodeData(node.id, { validateIndexedList: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {node.data.validateIndexedList && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                  Indexed List Var
                </label>
                <input
                  className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-gray-900 font-mono"
                  value={String(node.data.indexedListVar ?? "")}
                  onChange={(e) => updateNodeData(node.id, { indexedListVar: e.target.value })}
                  placeholder="accountsMenu"
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Invalid Index Message
                  </label>
                  <textarea
                    className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-gray-900 resize-none"
                    rows={2}
                    value={String(node.data.invalidInputMessage ?? "")}
                    onChange={(e) =>
                      updateNodeData(node.id, { invalidInputMessage: e.target.value })
                    }
                    placeholder="Invalid selection. Please try again."
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-50 mb-2">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Input Validation
              </h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(node.data.inputValidationEnabled)}
                onChange={(e) =>
                  updateNodeData(node.id, {
                    inputValidationEnabled: e.target.checked,
                    inputType: e.target.checked
                      ? (node.data.inputType ?? "STRING")
                      : node.data.inputType,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {node.data.inputValidationEnabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Type
                  </label>
                  <select
                    className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-emerald-500:bg-white transition-all text-gray-900"
                    value={String(node.data.inputType ?? "STRING")}
                    onChange={(e) => updateNodeData(node.id, { inputType: e.target.value })}
                  >
                    <option value="NON_ZERO_FLOAT">NON_ZERO_FLOAT</option>
                    <option value="NON_ZERO_INT">NON_ZERO_INT</option>
                    <option value="FLOAT">FLOAT</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="STRING">STRING</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                    Invalid Input
                  </label>
                  <textarea
                    className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-gray-900 resize-none"
                    rows={2}
                    value={String(node.data.invalidInputTypeMessage ?? "")}
                    onChange={(e) =>
                      updateNodeData(node.id, {
                        invalidInputTypeMessage: e.target.value,
                      })
                    }
                    placeholder="Input must be a valid string."
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
