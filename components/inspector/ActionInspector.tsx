"use client";

import React from "react";
import ActionHeader from "./action/ActionHeader";
import ActionRoutes from "./action/ActionRoutes";
import BodyEditor from "./action/BodyEditor";
import HeadersEditor from "./action/HeadersEditor";
import WebSocketPanel, { type WsLogEntry } from "./action/WebSocketPanel";

import RequestBar from "./action/RequestBar";
import ResponseViewer from "./action/ResponseViewer";
import ResponseMappingEditor from "./action/ResponseMappingEditor";
import ParamsEditor from "./action/ParamsEditor";
import { ActionNode, ActionRoute } from "./action/types";
import { useActionRequestStore, type StoredResponse } from "@/store/actionRequestStore";
import { useFlowStore } from "@/store/flow/flowStore";
import {
  callCurlProxy,
  fetchFlowSettings,
  type FlowSettingsResponse,
} from "@/lib/api";

type SourceMode = "api" | "local" | "ws";
type WsConnectionState = "disconnected" | "connecting" | "connected" | "error";
type ApiBodyMode = "json" | "soap" | "form";
type FormFieldRow = { id: string; key: string; value: string; description: string };

type ActionInspectorProps = {
  node: ActionNode;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

export default function ActionInspector({ node, updateNodeData }: ActionInspectorProps) {
  const { nodes } = useFlowStore();

  const generateId = React.useCallback(() => Math.random().toString(36).slice(2, 11), []);

  const parseFormEncodedBody = React.useCallback(
    (raw: string): FormFieldRow[] => {
      const text = raw.trim();
      if (!text) return [];
      const params = new URLSearchParams(text);
      const rows: FormFieldRow[] = [];
      params.forEach((value, key) => {
        rows.push({ id: generateId(), key, value, description: "" });
      });
      return rows;
    },
    [generateId]
  );

  const serializeFormEncodedBody = React.useCallback((rows: FormFieldRow[]) => {
    const params = new URLSearchParams();
    rows.forEach((row) => {
      const key = row.key.trim();
      if (!key) return;
      params.append(key, row.value);
    });
    return params.toString();
  }, []);

  const ensureFormRows = React.useCallback(
    (rows: FormFieldRow[]) =>
      rows.length > 0 ? rows : [{ id: generateId(), key: "", value: "", description: "" }],
    [generateId]
  );

  const bodyMode = (node.data.bodyMode as ApiBodyMode) ?? "json";
  const [apiBodyText, setApiBodyText] = React.useState<string>(() => {
    if (bodyMode === "soap" || bodyMode === "form") {
      return String(node.data.apiBodyRaw ?? "");
    }
    return JSON.stringify(node.data.apiBody ?? {}, null, 2);
  });
  const [formFields, setFormFields] = React.useState<FormFieldRow[]>(() =>
    ensureFormRows(parseFormEncodedBody(String(node.data.apiBodyRaw ?? "")))
  );
  const [headerPairs, setHeaderPairs] = React.useState<
    Array<{ id: string; key: string; value: string }>
  >(() => {
    const headers = node.data.headers || {};
    return Object.entries(headers).map(([key, value]) => ({
      id: Math.random().toString(36).substr(2, 9),
      key,
      value: String(value),
    }));
  });
  const [mappingPairs, setMappingPairs] = React.useState<
    Array<{ id: string; key: string; value: string; persist: boolean; encrypt: boolean }>
  >(() => {
    const mapping = node.data.responseMapping || {};
    const persisted = new Set(node.data.persistResponseMappingKeys || []);
    const encrypted = new Set(node.data.encryptResponseMappingKeys || []);
    return Object.entries(mapping).map(([key, value]) => ({
      id: Math.random().toString(36).substr(2, 9),
      key,
      value: String(value),
      persist: persisted.has(key),
      encrypt: encrypted.has(key),
    }));
  });
  const [apiBodyError, setApiBodyError] = React.useState<string | null>(null);
  const { curlTextByNodeId, responsesByNodeId, setCurlText, setResponse, updateResponse } =
    useActionRequestStore();
  const storedResponse = React.useMemo<StoredResponse>(
    () =>
      responsesByNodeId[node.id] ?? {
        status: null,
        statusText: "",
        headers: {},
        body: "",
        error: null,
      },
    [node.id, responsesByNodeId]
  );
  const [isSending, setIsSending] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<
    "params" | "headers" | "body" | "responseMapping" | "routing"
  >("params");
  const [baseUrl, setBaseUrl] = React.useState("");

  const flowName = React.useMemo(() => {
    const current = nodes.find((n) => n.id === node.id) ?? node;
    const currentParent =
      "parentNode" in current ? (current as { parentNode?: string | null }).parentNode : undefined;
    let parentId = currentParent ?? null;
    let groupId = parentId ?? null;
    while (parentId) {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) break;
      groupId = parentId;
      parentId = parent.parentNode ?? null;
    }
    if (groupId) {
      const children = nodes.filter((n) => n.parentNode === groupId);
      const startNode = children.find((n) => n.type === "start");
      return (startNode?.data as { flowName?: string } | undefined)?.flowName ?? "";
    }
    return (node.data as { flowName?: string } | undefined)?.flowName ?? "";
  }, [node, nodes]);

  React.useEffect(() => {
    if (!flowName) {
      setBaseUrl("");
      return;
    }
    let isActive = true;
    const loadSettings = async () => {
      try {
        const data = await fetchFlowSettings(flowName);
        const payload = data as FlowSettingsResponse | undefined;
        const value = payload?.data?.baseUrl;
        if (isActive) {
          setBaseUrl(typeof value === "string" ? value : "");
        }
      } catch {
        if (isActive) setBaseUrl("");
      }
    };
    loadSettings();
    return () => {
      isActive = false;
    };
  }, [flowName]);

  React.useEffect(() => {
    if (!baseUrl) return;
    const currentEndpoint = String(node.data.endpoint ?? "");
    const normalizedBase = baseUrl.replace(/\/+$/, "");
    let nextEndpoint = currentEndpoint;
    if (normalizedBase && currentEndpoint.startsWith(normalizedBase)) {
      return;
    } else if (currentEndpoint.startsWith("/")) {
      nextEndpoint = `${normalizedBase}${currentEndpoint}`;
    } else if (currentEndpoint && !currentEndpoint.startsWith("http")) {
      nextEndpoint = `${normalizedBase}/${currentEndpoint}`;
    } else if (!currentEndpoint) {
      nextEndpoint = normalizedBase;
    }
    if (nextEndpoint !== currentEndpoint) {
      updateNodeData(node.id, { endpoint: nextEndpoint });
    }
  }, [baseUrl, node.data.endpoint, node.id, updateNodeData]);
  const [sourceMode, setSourceMode] = React.useState<SourceMode>(() => {
    const initial = String(node.data.requestSource ?? "");
    return initial === "local" || initial === "ws" || initial === "api" ? initial : "api";
  });
  const wsRef = React.useRef<WebSocket | null>(null);
  const activeNodeIdRef = React.useRef(node.id);
  const [wsConnectionState, setWsConnectionState] =
    React.useState<WsConnectionState>("disconnected");
  const [wsCurlText, setWsCurlText] = React.useState(String(node.data.wsCurl ?? ""));
  const [wsUrl, setWsUrl] = React.useState(String(node.data.wsUrl ?? ""));
  const [wsProtocolsText, setWsProtocolsText] = React.useState(() =>
    Array.isArray(node.data.wsProtocols)
      ? node.data.wsProtocols.map((value) => String(value ?? "")).join(", ")
      : ""
  );
  const [wsDraftMessage, setWsDraftMessage] = React.useState(String(node.data.wsMessage ?? ""));
  const [wsMessages, setWsMessages] = React.useState<WsLogEntry[]>(() => {
    const initialLastMessage = String(node.data.wsLastMessage ?? "").trim();
    if (!initialLastMessage) return [];
    return [
      {
        id: `ws-initial-${node.id}`,
        direction: "incoming",
        message: initialLastMessage,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];
  });
  const latestWsIncomingMessage = React.useMemo(() => {
    for (let idx = wsMessages.length - 1; idx >= 0; idx -= 1) {
      const entry = wsMessages[idx];
      if (entry.direction === "incoming") return entry.message;
    }
    return String(node.data.wsLastMessage ?? "");
  }, [node.data.wsLastMessage, wsMessages]);
  const [fieldSearchQuery, setFieldSearchQuery] = React.useState("");
  const resolvedCurlText = curlTextByNodeId[node.id] ?? String(node.data.curl ?? "");

  React.useEffect(() => {
    if (curlTextByNodeId[node.id] !== undefined) return;
    const existingCurl = String(node.data.curl ?? "");
    if (!existingCurl) return;
    setCurlText(node.id, existingCurl);
  }, [curlTextByNodeId, node.id, node.data.curl, setCurlText]);

  const [paramPairs, setParamPairs] = React.useState<
    Array<{ id: string; key: string; value: string }>
  >(() => {
    const ep = String(node.data.endpoint ?? "");
    try {
      if (ep.includes("?")) {
        const query = ep.split("?")[1];
        const searchParams = new URLSearchParams(query);
        return Array.from(searchParams.entries()).map(([key, value]) => ({
          id: Math.random().toString(36).substr(2, 9),
          key,
          value,
        }));
      }
    } catch {}
    return [];
  });
  const localFieldPairs = React.useMemo(() => {
    const fieldsRaw = Array.isArray(node.data.fields)
      ? node.data.fields.map((value) => String(value ?? ""))
      : node.data.field !== undefined
        ? [String(node.data.field)]
        : [];
    const outputVarsRaw = Array.isArray(node.data.outputVars)
      ? node.data.outputVars.map((value) => String(value ?? ""))
      : node.data.outputVar !== undefined
        ? [String(node.data.outputVar)]
        : [];

    const count = Math.max(fieldsRaw.length, outputVarsRaw.length, 1);
    const fields = Array.from({ length: count }, (_, i) => fieldsRaw[i] ?? "");
    const outputVars = Array.from({ length: count }, (_, i) => outputVarsRaw[i] ?? fields[i] ?? "");

    return { fields, outputVars };
  }, [node.data.fields, node.data.field, node.data.outputVars, node.data.outputVar]);

  const persistManager = (node.data.persistManager ?? "inputManager") as
    | "inputManager"
    | "commonManager";
  const commonManagerSaveMode = (node.data.commonManagerSaveMode ?? "flowSession") as
    | "flowSession"
    | "provided"
    | "generate";
  const localDataSource = (node.data.dataSource ?? "inputManager") as
    | "inputManager"
    | "redis"
    | "commonManager";
  const commonManagerFetchMode = (node.data.commonManagerFetchMode ?? "session") as
    | "session"
    | "search";

  const updateLocalFieldPairs = React.useCallback(
    (fields: string[], outputVars: string[]) => {
      updateNodeData(node.id, {
        fields,
        outputVars,
        field: fields[0] ?? "",
        outputVar: outputVars[0] ?? "",
      });
    },
    [node.id, updateNodeData]
  );

  const buildResponseOptions = React.useCallback((value: unknown, rootPrefix = "") => {
    const paths = new Set<string>();

    const walk = (current: unknown, prefix: string) => {
      if (current && typeof current === "object" && !Array.isArray(current)) {
        const entries = Object.entries(current as Record<string, unknown>);
        entries.forEach(([key, val]) => {
          const next = prefix ? `${prefix}.${key}` : key;
          paths.add(next);
          walk(val, next);
        });
        return;
      }

      if (Array.isArray(current)) {
        if (prefix) {
          paths.add(prefix);
        }
        if (current.length > 0 && typeof current[0] === "object") {
          walk(current[0], prefix);
        }
      }
    };

    if (rootPrefix) {
      paths.add(rootPrefix);
    }
    walk(value, rootPrefix);
    return Array.from(paths);
  }, []);

  const buildXmlResponseOptions = React.useCallback((xmlText: string) => {
    if (typeof window === "undefined") return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      return [];
    }

    const paths = new Set<string>();
    const walk = (node: Element, prefix: string) => {
      const children = Array.from(node.children);
      if (children.length === 0) {
        if (prefix) paths.add(prefix);
        return;
      }
      children.forEach((child) => {
        const tag = child.tagName;
        const next = prefix ? `${prefix}.${tag}` : tag;
        paths.add(next);
        walk(child, next);
      });
    };

    const root = doc.documentElement;
    if (!root) return [];
    walk(root, root.tagName);
    return Array.from(paths);
  }, []);

  const responseOptions = React.useMemo(() => {
    const body = storedResponse.body.trim();
    const options: string[] = [];

    if (storedResponse.status !== null) {
      options.push("statusCode");
    }

    const headerKeys = Object.keys(storedResponse.headers || {});
    headerKeys.forEach((key) => {
      if (key.trim()) {
        options.push(`headers.${key}`);
      }
    });

    if (!body) return options;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === "string") {
        const xmlText = parsed.trim();
        if (xmlText.startsWith("<")) {
          return [...options, ...buildXmlResponseOptions(xmlText).map((path) => `data.${path}`)];
        }
        return [...options, "data"];
      }
      return [...options, ...buildResponseOptions(parsed, "data")];
    } catch {
      if (body.startsWith("<")) {
        return [...options, ...buildXmlResponseOptions(body).map((path) => `data.${path}`)];
      }
      return [...options, "data"];
    }
  }, [
    storedResponse.body,
    storedResponse.headers,
    storedResponse.status,
    buildResponseOptions,
    buildXmlResponseOptions,
  ]);

  React.useEffect(() => {
    if (bodyMode === "soap") {
      const rawBody = String(node.data.apiBodyRaw ?? "");
      if (rawBody !== apiBodyText) {
        setApiBodyText(rawBody);
      }
      setApiBodyError(null);
      return;
    }

    if (bodyMode === "form") {
      const rawBody = String(node.data.apiBodyRaw ?? "");
      if (rawBody !== apiBodyText) {
        setApiBodyText(rawBody);
        setFormFields(ensureFormRows(parseFormEncodedBody(rawBody)));
      }
      setApiBodyError(null);
      return;
    }

    const nextJsonBody = JSON.stringify(node.data.apiBody ?? {}, null, 2);
    if (nextJsonBody !== apiBodyText) {
      setApiBodyText(nextJsonBody);
    }
    setApiBodyError(null);
  }, [
    apiBodyText,
    bodyMode,
    ensureFormRows,
    node.data.apiBody,
    node.data.apiBodyRaw,
    node.id,
    parseFormEncodedBody,
  ]);

  const availablePersistedFields = React.useMemo(() => {
    // Helper to find the outermost parent group ID
    const findOutermostParent = (nodeId: string): string | null => {
      let current = nodes.find((n) => n.id === nodeId);
      let outermost: string | null = null;
      while (current && current.parentNode) {
        outermost = current.parentNode;
        current = nodes.find((n) => n.id === current?.parentNode);
      }
      return outermost;
    };

    const outermostParentId = findOutermostParent(node.id);

    // Filter nodes:
    // If we are in a group, only show nodes in that same top-level group.
    // If we are at root, show only root nodes (nodes without parentNode).
    const relevantNodes = nodes.filter((n) => {
      if (outermostParentId) {
        // Node belongs to the same flow if its outermost parent is the same
        return findOutermostParent(n.id) === outermostParentId || n.id === outermostParentId;
      } else {
        // Node is at root
        return !n.parentNode;
      }
    });

    const fieldSet = new Set<string>();
    relevantNodes.forEach((n) => {
      // 1. From Prompt nodes
      if (n.type === "prompt") {
        if (n.data.persistInput && n.data.persistInputAs) {
          fieldSet.add(String(n.data.persistInputAs));
        }
        if (n.data.persistByIndex && n.data.persistFieldName) {
          fieldSet.add(String(n.data.persistFieldName));
        }
      }
      // 2. From Action nodes
      if (n.type === "action") {
        const persistKeys = n.data.persistResponseMappingKeys as string[];
        if (Array.isArray(persistKeys)) {
          persistKeys.forEach((k) => fieldSet.add(k));
        }
      }
    });

    const sorted = Array.from(fieldSet).sort();
    if (!fieldSearchQuery.trim()) return sorted;

    const query = fieldSearchQuery.toLowerCase();
    return sorted.filter((f) => f.toLowerCase().includes(query));
  }, [nodes, node.id, fieldSearchQuery]);

  React.useEffect(() => {
    const current = String(node.data.dataSource ?? "").trim();
    if (!current) {
      updateNodeData(node.id, { dataSource: "inputManager" });
    }
  }, [node.data.dataSource, node.id, updateNodeData]);

  React.useEffect(() => {
    const requestSource = String(node.data.requestSource ?? "");
    if (requestSource === "api" || requestSource === "local" || requestSource === "ws") {
      setSourceMode(requestSource);
      return;
    }
    setSourceMode("api");
    updateNodeData(node.id, { requestSource: "api" });
  }, [node.data.requestSource, node.id, updateNodeData]);

  React.useEffect(() => {
    if (activeNodeIdRef.current === node.id) return;
    activeNodeIdRef.current = node.id;
    if (wsRef.current) {
      wsRef.current.close(1000, "Node changed");
      wsRef.current = null;
    }
    setWsConnectionState("disconnected");
    setWsCurlText(String(node.data.wsCurl ?? ""));
    setWsUrl(String(node.data.wsUrl ?? ""));
    setWsProtocolsText(
      Array.isArray(node.data.wsProtocols)
        ? node.data.wsProtocols.map((value) => String(value ?? "")).join(", ")
        : ""
    );
    setWsDraftMessage(String(node.data.wsMessage ?? ""));
    const initialLastMessage = String(node.data.wsLastMessage ?? "").trim();
    setWsMessages(
      initialLastMessage
        ? [
            {
              id: `ws-initial-${node.id}`,
              direction: "incoming",
              message: initialLastMessage,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]
        : []
    );
  }, [
    node.data.wsCurl,
    node.data.wsLastMessage,
    node.data.wsMessage,
    node.data.wsProtocols,
    node.data.wsUrl,
    node.id,
  ]);

  const syncResponseMapping = React.useCallback(
    (
      pairs: Array<{ id: string; key: string; value: string; persist: boolean; encrypt: boolean }>
    ) => {
      const mapping: Record<string, string> = {};
      const persistKeys: string[] = [];
      const encryptKeys: string[] = [];
      pairs.forEach((pair) => {
        if (pair.key.trim()) {
          mapping[pair.key] = pair.value;
          if (pair.persist) persistKeys.push(pair.key.trim());
          if (pair.encrypt) encryptKeys.push(pair.key.trim());
        }
      });
      updateNodeData(node.id, {
        responseMapping: mapping,
        persistResponseMappingKeys: persistKeys,
        encryptResponseMappingKeys: encryptKeys,
      });
    },
    [node.id, updateNodeData]
  );
  const parseCurl = React.useCallback((raw: string) => {
    const cleaned = raw.replace(/\\\r?\n/g, " ").trim();
    if (!cleaned.toLowerCase().startsWith("curl ")) {
      return null;
    }

    const tokens: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === `"` && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && /\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }
      current += ch;
    }
    if (current) {
      tokens.push(current);
    }

    let method = "";
    let url = "";
    const headers: Record<string, string> = {};
    let body = "";
    const urlEncodedEntries: Array<{ key: string; value: string }> = [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === "curl") continue;

      if (token === "-X" || token === "--request") {
        method = tokens[i + 1] || method;
        i += 1;
        continue;
      }

      if (token === "-H" || token === "--header") {
        const headerLine = tokens[i + 1] || "";
        i += 1;
        const index = headerLine.indexOf(":");
        if (index !== -1) {
          const key = headerLine.slice(0, index).trim();
          const value = headerLine.slice(index + 1).trim();
          if (key) {
            headers[key] = value;
          }
        }
        continue;
      }

      if (
        token === "--data" ||
        token === "--data-raw" ||
        token === "--data-binary" ||
        token === "-d"
      ) {
        body = tokens[i + 1] || "";
        i += 1;
        continue;
      }

      if (token === "--data-urlencode") {
        const entry = tokens[i + 1] || "";
        i += 1;

        const separatorIndex = entry.indexOf("=");
        if (separatorIndex !== -1) {
          const key = entry.slice(0, separatorIndex);
          const value = entry.slice(separatorIndex + 1);
          urlEncodedEntries.push({ key, value });
        } else if (entry) {
          urlEncodedEntries.push({ key: entry, value: "" });
        }
        continue;
      }

      if (!token.startsWith("-") && !url) {
        url = token;
      }
    }

    if (urlEncodedEntries.length > 0) {
      const params = new URLSearchParams();
      urlEncodedEntries.forEach(({ key, value }) => {
        params.append(key, value);
      });
      body = params.toString();
    }

    if (!method) {
      method = body ? "POST" : "GET";
    }

    return { method, url, headers, body };
  }, []);

  const parseWsCurl = React.useCallback((raw: string) => {
    const cleaned = raw.replace(/\\\r?\n/g, " ").trim();
    if (!cleaned.toLowerCase().startsWith("curl ")) {
      return null;
    }

    const tokens: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === `"` && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && /\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }
      current += ch;
    }
    if (current) {
      tokens.push(current);
    }

    let url = "";
    const headers: Record<string, string> = {};
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === "curl") continue;
      if (token === "-H" || token === "--header") {
        const headerLine = tokens[i + 1] || "";
        i += 1;
        const sep = headerLine.indexOf(":");
        if (sep !== -1) {
          const key = headerLine.slice(0, sep).trim();
          const value = headerLine.slice(sep + 1).trim();
          if (key) headers[key] = value;
        }
        continue;
      }
      if (!token.startsWith("-") && !url) {
        url = token;
      }
    }

    const protocolHeader =
      headers["Sec-WebSocket-Protocol"] ?? headers["sec-websocket-protocol"] ?? "";
    const protocols = protocolHeader
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const normalizedUrl = url.startsWith("https://")
      ? `wss://${url.slice("https://".length)}`
      : url.startsWith("http://")
        ? `ws://${url.slice("http://".length)}`
        : url;

    return { url: normalizedUrl, protocols };
  }, []);

  const syncHeaders = React.useCallback(
    (pairs: Array<{ id: string; key: string; value: string }>) => {
      const headers: Record<string, string> = {};
      pairs.forEach((pair) => {
        if (pair.key.trim()) {
          headers[pair.key] = pair.value;
        }
      });
      updateNodeData(node.id, { headers });
    },
    [node.id, updateNodeData]
  );

  const syncParamsToUrl = (pairs: Array<{ id: string; key: string; value: string }>) => {
    const currentEp = String(node.data.endpoint ?? "");
    const baseUrl = currentEp.split("?")[0];

    const queryString = pairs
      .filter((p) => p.key.trim())
      .map((p) => `${p.key}=${p.value ?? ""}`)
      .join("&");

    const newEndpoint = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    updateNodeData(node.id, { endpoint: newEndpoint });
  };

  const syncUrlToParams = (newUrl: string) => {
    try {
      if (newUrl.includes("?")) {
        const query = newUrl.split("?")[1];
        const newPairs = query
          .split("&")
          .filter((pair) => pair !== "")
          .map((pair) => {
            const [rawKey, ...rest] = pair.split("=");
            return {
              id: generateId(),
              key: rawKey ?? "",
              value: rest.join("=") ?? "",
            };
          });
        setParamPairs(newPairs);
      } else {
        setParamPairs([]);
      }
    } catch {}
  };

  const parseWsProtocols = React.useCallback((raw: string) => {
    const unique = new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    );
    return Array.from(unique);
  }, []);

  const appendWsMessage = React.useCallback(
    (direction: WsLogEntry["direction"], message: string) => {
      const next: WsLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        direction,
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      setWsMessages((current) => {
        const merged = [...current, next];
        if (merged.length > 200) return merged.slice(merged.length - 200);
        return merged;
      });
    },
    []
  );

  const disconnectWebSocket = React.useCallback(
    (reason?: string) => {
      const socket = wsRef.current;
      if (!socket) {
        setWsConnectionState("disconnected");
        return;
      }
      if (reason) {
        appendWsMessage("system", reason);
      }
      socket.close(1000, reason ?? "Client disconnected");
    },
    [appendWsMessage]
  );

  const connectWebSocket = React.useCallback(() => {
    const targetUrl = wsUrl.trim();
    if (!targetUrl) {
      updateResponse(node.id, { error: "WebSocket URL is required." });
      return;
    }
    if (!/^wss?:\/\//i.test(targetUrl)) {
      updateResponse(node.id, { error: "WebSocket URL must start with ws:// or wss://." });
      return;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Reconnect");
      wsRef.current = null;
    }

    const protocols = parseWsProtocols(wsProtocolsText);
    const messageFromNode = wsDraftMessage;
    updateNodeData(node.id, {
      requestSource: "ws",
      wsUrl: targetUrl,
      wsProtocols: protocols,
      wsMessage: messageFromNode,
    });

    setResponse(node.id, {
      status: null,
      statusText: "",
      headers: {},
      body: "",
      error: null,
    });
    setWsConnectionState("connecting");
    appendWsMessage("system", `Connecting to ${targetUrl}`);

    try {
      const socket =
        protocols.length > 0 ? new WebSocket(targetUrl, protocols) : new WebSocket(targetUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnectionState("connected");
        updateResponse(node.id, { error: null });
        appendWsMessage("system", "Connected");
      };

      socket.onmessage = (event) => {
        const onText = (value: string) => {
          appendWsMessage("incoming", value);
          updateNodeData(node.id, { wsLastMessage: value });
          updateResponse(node.id, {
            status: null,
            statusText: "",
            headers: {},
            body: value,
            error: null,
          });
        };

        if (typeof event.data === "string") {
          onText(event.data);
          return;
        }
        if (event.data instanceof Blob) {
          event.data
            .text()
            .then((value) => onText(value))
            .catch(() => onText("[binary message]"));
          return;
        }
        if (event.data instanceof ArrayBuffer) {
          const decoder = new TextDecoder();
          onText(decoder.decode(event.data));
          return;
        }
        onText(String(event.data));
      };

      socket.onerror = () => {
        setWsConnectionState("error");
        updateResponse(node.id, { error: "WebSocket connection error." });
        appendWsMessage("system", "WebSocket error");
      };

      socket.onclose = (event) => {
        wsRef.current = null;
        setWsConnectionState("disconnected");
        const details = event.reason ? `${event.code} - ${event.reason}` : String(event.code);
        appendWsMessage("system", `Disconnected (${details})`);
      };
    } catch (error) {
      setWsConnectionState("error");
      updateResponse(node.id, {
        error: error instanceof Error ? error.message : "Failed to open WebSocket connection.",
      });
      appendWsMessage("system", "Failed to connect");
    }
  }, [
    appendWsMessage,
    node.id,
    parseWsProtocols,
    setResponse,
    updateNodeData,
    updateResponse,
    wsDraftMessage,
    wsProtocolsText,
    wsUrl,
  ]);

  const sendWebSocketMessage = React.useCallback(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      updateResponse(node.id, { error: "WebSocket is not connected." });
      return;
    }
    const payload = wsDraftMessage;
    try {
      socket.send(payload);
      appendWsMessage("outgoing", payload);
      updateNodeData(node.id, {
        requestSource: "ws",
        wsUrl,
        wsProtocols: parseWsProtocols(wsProtocolsText),
        wsMessage: payload,
      });
      updateResponse(node.id, { error: null });
    } catch (error) {
      updateResponse(node.id, {
        error: error instanceof Error ? error.message : "Failed to send WebSocket message.",
      });
    }
  }, [
    appendWsMessage,
    node.id,
    parseWsProtocols,
    updateNodeData,
    updateResponse,
    wsDraftMessage,
    wsProtocolsText,
    wsUrl,
  ]);

  React.useEffect(() => {
    if (sourceMode !== "ws" && wsRef.current) {
      wsRef.current.close(1000, "Switched source mode");
      wsRef.current = null;
      setWsConnectionState("disconnected");
    }
  }, [sourceMode]);

  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Inspector unmounted");
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <ActionHeader
        nodeId={node.id}
        name={String(node.data.name ?? "")}
        endpoint={String(node.data.endpoint ?? "")}
        onNameChange={(value) => updateNodeData(node.id, { name: value })}
        onEndpointChange={(value) => {
          updateNodeData(node.id, { endpoint: value });
          syncUrlToParams(value);
        }}
      />

      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          className={`px-3 py-1 text-xs font-medium rounded-md ${
            sourceMode === "api"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          onClick={() => {
            if (sourceMode === "ws") {
              disconnectWebSocket("Switched to API mode");
            }
            setSourceMode("api");
            updateNodeData(node.id, { requestSource: "api" });
          }}
        >
          From API
        </button>
        <button
          className={`px-3 py-1 text-xs font-medium rounded-md ${
            sourceMode === "local"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          onClick={() => {
            if (sourceMode === "ws") {
              disconnectWebSocket("Switched to Local Storage mode");
            }
            setSourceMode("local");
            updateNodeData(node.id, { requestSource: "local" });
          }}
        >
          From Local Storage
        </button>
        <button
          className={`px-3 py-1 text-xs font-medium rounded-md ${
            sourceMode === "ws"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          onClick={() => {
            setSourceMode("ws");
            updateNodeData(node.id, { requestSource: "ws" });
          }}
        >
          From WebSocket
        </button>
      </div>

      {sourceMode === "api" && (
        <>
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-600">Request</div>
            <RequestBar
              method={String(node.data.method ?? "POST")}
              endpoint={String(node.data.endpoint ?? "")}
              curlText={resolvedCurlText}
              isSending={isSending}
              baseUrlToken={baseUrl ? "baseUrl" : undefined}
              baseUrlValue={baseUrl || undefined}
              onClearBaseUrl={() => {
                const currentEndpoint = String(node.data.endpoint ?? "");
                const normalizedBase = baseUrl.replace(/\/+$/, "");
                let nextEndpoint = currentEndpoint;
                if (normalizedBase && currentEndpoint.startsWith(normalizedBase)) {
                  nextEndpoint = currentEndpoint.slice(normalizedBase.length).replace(/^\/+/, "");
                }
                setBaseUrl("");
                updateNodeData(node.id, { endpoint: nextEndpoint });
              }}
              onMethodChange={(value) => updateNodeData(node.id, { method: value })}
              onEndpointChange={(value) => updateNodeData(node.id, { endpoint: value })}
              onCurlChange={(value) => {
                setCurlText(node.id, value);
                updateNodeData(node.id, { curl: value });
              }}
              onImportCurl={() => {
                const parsed = parseCurl(resolvedCurlText);
                if (!parsed) {
                  updateResponse(node.id, {
                    error: "Invalid curl input. Paste a curl command that starts with 'curl'.",
                  });
                  return;
                }

                updateNodeData(node.id, { curl: resolvedCurlText });
                updateNodeData(node.id, { method: parsed.method });
                updateNodeData(node.id, { endpoint: parsed.url });
                syncUrlToParams(parsed.url);

                const pairs = Object.entries(parsed.headers).map(([key, value]) => ({
                  id: generateId(),
                  key,
                  value,
                }));
                setHeaderPairs(pairs);
                syncHeaders(pairs);

                if (parsed.body) {
                  const trimmed = parsed.body.trim();
                  const looksXml = trimmed.startsWith("<");
                  const contentTypeHeader = Object.entries(parsed.headers).find(
                    ([key]) => key.toLowerCase() === "content-type"
                  )?.[1];
                  const isFormUrlEncoded =
                    typeof contentTypeHeader === "string" &&
                    contentTypeHeader.toLowerCase().includes("application/x-www-form-urlencoded");

                  if (looksXml) {
                    updateNodeData(node.id, {
                      bodyMode: "soap",
                      apiBodyRaw: parsed.body,
                    });
                    setApiBodyText(parsed.body);
                    setApiBodyError(null);
                  } else if (isFormUrlEncoded) {
                    const nextFormFields = ensureFormRows(parseFormEncodedBody(parsed.body));
                    updateNodeData(node.id, {
                      bodyMode: "form",
                      apiBodyRaw: parsed.body,
                    });
                    setFormFields(nextFormFields);
                    setApiBodyText(parsed.body);
                    setApiBodyError(null);
                  } else {
                    updateNodeData(node.id, { bodyMode: "json" });
                    setApiBodyText(parsed.body);
                    try {
                      const parsedBody = JSON.parse(parsed.body);
                      setApiBodyError(null);
                      updateNodeData(node.id, { apiBody: parsedBody });
                    } catch (err) {
                      setApiBodyError(err instanceof Error ? err.message : "Invalid JSON");
                    }
                  }
                }
              }}
              onSend={async () => {
                setResponse(node.id, {
                  status: null,
                  statusText: "",
                  headers: {},
                  body: "",
                  error: null,
                });
                setIsSending(true);

                const endpoint = String(node.data.endpoint ?? "").trim();
                if (!endpoint) {
                  updateResponse(node.id, {
                    error: "Endpoint URL is required.",
                  });
                  setIsSending(false);
                  return;
                }

                const method = String(node.data.method ?? "POST").toUpperCase();
                const headers: Record<string, string> = {};
                headerPairs.forEach((pair) => {
                  if (pair.key.trim()) {
                    headers[pair.key] = pair.value;
                  }
                });

                let body: string | undefined;
                if (method !== "GET" && method !== "HEAD") {
                  body = apiBodyText ? apiBodyText : undefined;
                }

                try {
                  const proxyResponse = (await callCurlProxy({
                    url: endpoint,
                    method,
                    headers,
                    body,
                  })) as Record<string, unknown>;

                  const responseCandidates = [
                    proxyResponse,
                    proxyResponse.data,
                    proxyResponse.response,
                    proxyResponse.payload,
                    proxyResponse.result,
                  ].filter(
                    (candidate): candidate is Record<string, unknown> =>
                      Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate)
                  );

                  const resolvedResponse =
                    responseCandidates.find(
                      (candidate) =>
                        typeof candidate.status === "number" ||
                        typeof candidate.statusCode === "number" ||
                        candidate.body !== undefined ||
                        candidate.responseBody !== undefined ||
                        candidate.headers !== undefined ||
                        candidate.responseHeaders !== undefined
                    ) ?? proxyResponse;

                  const proxyStatus =
                    typeof resolvedResponse.status === "number"
                      ? resolvedResponse.status
                      : typeof resolvedResponse.statusCode === "number"
                        ? resolvedResponse.statusCode
                        : null;
                  const proxyStatusText =
                    typeof resolvedResponse.statusText === "string"
                      ? resolvedResponse.statusText
                      : typeof resolvedResponse.message === "string"
                        ? resolvedResponse.message
                        : typeof proxyResponse.message === "string"
                          ? proxyResponse.message
                          : "";
                  const proxyHeadersSource =
                    resolvedResponse.headers && typeof resolvedResponse.headers === "object"
                      ? (resolvedResponse.headers as Record<string, unknown>)
                      : resolvedResponse.responseHeaders &&
                          typeof resolvedResponse.responseHeaders === "object"
                        ? (resolvedResponse.responseHeaders as Record<string, unknown>)
                        : {};
                  const normalizedHeaders = Object.fromEntries(
                    Object.entries(proxyHeadersSource).map(([key, value]) => [key, String(value)])
                  );

                  let responseBody = "";
                  const bodyCandidate =
                    resolvedResponse.body ??
                    resolvedResponse.responseBody ??
                    (typeof resolvedResponse.data === "string" ||
                    Array.isArray(resolvedResponse.data) ||
                    (resolvedResponse.data &&
                      typeof resolvedResponse.data === "object" &&
                      !("status" in (resolvedResponse.data as Record<string, unknown>)) &&
                      !("body" in (resolvedResponse.data as Record<string, unknown>)))
                      ? resolvedResponse.data
                      : undefined);
                  if (typeof bodyCandidate === "string") {
                    responseBody = bodyCandidate;
                  } else if (bodyCandidate !== undefined) {
                    responseBody = JSON.stringify(bodyCandidate, null, 2);
                  } else if (Object.keys(proxyResponse).length > 0) {
                    responseBody = JSON.stringify(proxyResponse, null, 2);
                  }

                  updateResponse(node.id, {
                    status: proxyStatus,
                    statusText: proxyStatusText,
                    headers: normalizedHeaders,
                    body: responseBody,
                  });
                } catch (err) {
                  updateResponse(node.id, {
                    error: err instanceof Error ? err.message : "Request failed.",
                  });
                } finally {
                  setIsSending(false);
                }
              }}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  activeSection === "params"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection("params")}
              >
                Params
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  activeSection === "headers"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection("headers")}
              >
                Headers
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  activeSection === "body"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection("body")}
              >
                Body
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  activeSection === "responseMapping"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection("responseMapping")}
              >
                Response Mapping
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  activeSection === "routing"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection("routing")}
              >
                Routing
              </button>
            </div>

            <div className="mt-4">
              {activeSection === "params" && (
                <ParamsEditor
                  params={paramPairs}
                  onAdd={() => {
                    const next = [...paramPairs, { id: generateId(), key: "", value: "" }];
                    setParamPairs(next);
                  }}
                  onRemove={(id: string) => {
                    const next = paramPairs.filter((p) => p.id !== id);
                    setParamPairs(next);
                    syncParamsToUrl(next);
                  }}
                  onUpdate={(id: string, key: string, value: string) => {
                    const next = paramPairs.map((p) => (p.id === id ? { ...p, key, value } : p));
                    setParamPairs(next);
                    syncParamsToUrl(next);
                  }}
                />
              )}

              {activeSection === "headers" && (
                <HeadersEditor
                  headers={headerPairs}
                  onAdd={() => {
                    const next = [...headerPairs, { id: generateId(), key: "", value: "" }];
                    setHeaderPairs(next);
                  }}
                  onRemove={(id) => {
                    const next = headerPairs.filter((pair) => pair.id !== id);
                    setHeaderPairs(next);
                    syncHeaders(next);
                  }}
                  onUpdate={(id, key, value) => {
                    const next = headerPairs.map((pair) =>
                      pair.id === id ? { ...pair, key, value } : pair
                    );
                    setHeaderPairs(next);
                    syncHeaders(next);
                  }}
                />
              )}

              {activeSection === "body" && (
                <BodyEditor
                  apiBodyText={apiBodyText}
                  apiBodyError={apiBodyError}
                  bodyMode={bodyMode}
                  formFields={formFields}
                  onBodyModeChange={(value) => {
                    updateNodeData(node.id, { bodyMode: value });
                    if (value === "soap") {
                      updateNodeData(node.id, { apiBodyRaw: apiBodyText });
                      setApiBodyError(null);
                      return;
                    }
                    if (value === "form") {
                      let nextFormFields = ensureFormRows(parseFormEncodedBody(apiBodyText));
                      if (bodyMode === "json") {
                        try {
                          const parsed = JSON.parse(apiBodyText || "{}") as Record<string, unknown>;
                          nextFormFields = ensureFormRows(
                            Object.entries(parsed).map(([key, fieldValue]) => ({
                              id: generateId(),
                              key,
                              value:
                                typeof fieldValue === "string"
                                  ? fieldValue
                                  : JSON.stringify(fieldValue),
                              description: "",
                            }))
                          );
                        } catch {}
                      }
                      const encodedBody = serializeFormEncodedBody(nextFormFields);
                      setFormFields(nextFormFields);
                      setApiBodyText(encodedBody);
                      updateNodeData(node.id, { apiBodyRaw: encodedBody });
                      setApiBodyError(null);
                      return;
                    }
                    try {
                      let parsed: Record<string, unknown>;
                      if (bodyMode === "form") {
                        parsed = Object.fromEntries(
                          formFields
                            .filter((item) => item.key.trim())
                            .map((item) => [item.key.trim(), item.value])
                        );
                        setApiBodyText(JSON.stringify(parsed, null, 2));
                      } else {
                        parsed = JSON.parse(apiBodyText || "{}");
                      }
                      setApiBodyError(null);
                      updateNodeData(node.id, { apiBody: parsed });
                    } catch (err) {
                      setApiBodyError(err instanceof Error ? err.message : "Invalid JSON");
                    }
                  }}
                  onApiBodyChange={(value) => {
                    setApiBodyText(value);
                    if (bodyMode === "soap" || bodyMode === "form") {
                      updateNodeData(node.id, { apiBodyRaw: value });
                      setApiBodyError(null);
                      return;
                    }
                    try {
                      const parsed = JSON.parse(value || "{}");
                      setApiBodyError(null);
                      updateNodeData(node.id, { apiBody: parsed });
                    } catch (err) {
                      setApiBodyError(err instanceof Error ? err.message : "Invalid JSON");
                    }
                  }}
                  onAddFormField={() => {
                    const next = [
                      ...formFields,
                      { id: generateId(), key: "", value: "", description: "" },
                    ];
                    setFormFields(next);
                    const encodedBody = serializeFormEncodedBody(next);
                    setApiBodyText(encodedBody);
                    updateNodeData(node.id, { apiBodyRaw: encodedBody });
                  }}
                  onRemoveFormField={(id) => {
                    const next = formFields.filter((field) => field.id !== id);
                    const normalized = ensureFormRows(next);
                    setFormFields(normalized);
                    const encodedBody = serializeFormEncodedBody(normalized);
                    setApiBodyText(encodedBody);
                    updateNodeData(node.id, { apiBodyRaw: encodedBody });
                  }}
                  onUpdateFormField={(id, field, value) => {
                    const next = formFields.map((item) =>
                      item.id === id ? { ...item, [field]: value } : item
                    );
                    setFormFields(next);
                    const encodedBody = serializeFormEncodedBody(next);
                    setApiBodyText(encodedBody);
                    updateNodeData(node.id, { apiBodyRaw: encodedBody });
                  }}
                />
              )}

              {activeSection === "responseMapping" && (
                <ResponseMappingEditor
                  mappings={mappingPairs}
                  options={responseOptions}
                  persistManager={persistManager}
                  commonManagerSaveMode={commonManagerSaveMode}
                  commonManagerSaveSessionId={String(node.data.commonManagerSaveSessionId ?? "")}
                  commonManagerSessionOutputVar={String(
                    node.data.commonManagerSessionOutputVar ?? ""
                  )}
                  onAdd={() => {
                    const next = [
                      ...mappingPairs,
                      { id: generateId(), key: "", value: "", persist: false, encrypt: false },
                    ];
                    setMappingPairs(next);
                  }}
                  onRemove={(id) => {
                    const next = mappingPairs.filter((pair) => pair.id !== id);
                    setMappingPairs(next);
                    syncResponseMapping(next);
                  }}
                  onUpdate={(id, key, value, persist, encrypt) => {
                    const next = mappingPairs.map((pair) =>
                      pair.id === id ? { ...pair, key, value, persist, encrypt } : pair
                    );
                    setMappingPairs(next);
                    syncResponseMapping(next);
                  }}
                  onPersistManagerChange={(value) =>
                    updateNodeData(node.id, { persistManager: value })
                  }
                  onCommonManagerSaveModeChange={(value) =>
                    updateNodeData(node.id, { commonManagerSaveMode: value })
                  }
                  onCommonManagerSaveSessionIdChange={(value) =>
                    updateNodeData(node.id, { commonManagerSaveSessionId: value })
                  }
                  onCommonManagerSessionOutputVarChange={(value) =>
                    updateNodeData(node.id, { commonManagerSessionOutputVar: value })
                  }
                />
              )}

              {activeSection === "routing" && (
                <ActionRoutes
                  routes={node.data.routes || []}
                  options={responseOptions}
                  defaultNextNode={node.data.nextNode}
                  onAddRoute={() => {
                    const currentRoutes = node.data.routes || [];
                    const defaultPath = responseOptions[0] || "";
                    const condition = JSON.stringify({
                      eq: [`{{response.${defaultPath}}}`, ""],
                    });
                    updateNodeData(node.id, {
                      routes: [
                        ...currentRoutes,
                        {
                          id: generateId(),
                          condition,
                          nextNodeId: "",
                        },
                      ],
                    });
                  }}
                  onRemoveRoute={(index) => {
                    const currentRoutes = node.data.routes || [];
                    updateNodeData(node.id, {
                      routes: currentRoutes.filter((_, i) => i !== index),
                    });
                  }}
                  onUpdateRoute={(index, route) => {
                    const newRoutes: ActionRoute[] = [...(node.data.routes || [])];
                    newRoutes[index] = route;
                    updateNodeData(node.id, { routes: newRoutes });
                  }}
                />
              )}
            </div>
          </div>

          <ResponseViewer
            status={storedResponse.status}
            statusText={storedResponse.statusText}
            headers={storedResponse.headers}
            body={storedResponse.body}
            error={storedResponse.error}
          />
        </>
      )}

      {sourceMode === "local" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Data Source</label>
              <select
                className="mt-2 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                value={localDataSource}
                onChange={(e) => updateNodeData(node.id, { dataSource: e.target.value })}
              >
                <option value="inputManager">inputManager</option>
                <option value="commonManager">commonManager</option>
                <option value="redis">redis</option>
              </select>
            </div>

            {localDataSource === "commonManager" && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Fetch Mode
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                    value={commonManagerFetchMode}
                    onChange={(e) =>
                      updateNodeData(node.id, {
                        commonManagerFetchMode: e.target.value as "session" | "search",
                      })
                    }
                  >
                    <option value="session">By session id</option>
                    <option value="search">By field search</option>
                  </select>
                </div>
                {commonManagerFetchMode === "session" ? (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Session Id
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                      placeholder="{{vars.sessionId}}"
                      value={String(node.data.commonManagerFetchSessionId ?? "")}
                      onChange={(e) =>
                        updateNodeData(node.id, {
                          commonManagerFetchSessionId: e.target.value,
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Search Field
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                        placeholder="phoneNumber"
                        value={String(node.data.commonManagerSearchField ?? "")}
                        onChange={(e) =>
                          updateNodeData(node.id, {
                            commonManagerSearchField: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Search Value
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                        placeholder="{{vars.phoneNumber}}"
                        value={String(node.data.commonManagerSearchValue ?? "")}
                        onChange={(e) =>
                          updateNodeData(node.id, {
                            commonManagerSearchValue: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Available Persisted Fields
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search fields..."
                    className="text-[10px] px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-indigo-400 w-32 transition-all bg-gray-50/50 text-gray-900"
                    value={fieldSearchQuery}
                    onChange={(e) => setFieldSearchQuery(e.target.value)}
                  />
                  {fieldSearchQuery && (
                    <button
                      onClick={() => setFieldSearchQuery("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50/50 rounded-lg border border-gray-100 max-h-40 overflow-y-auto">
                {availablePersistedFields.length > 0 ? (
                  availablePersistedFields.map((field) => {
                    const isChecked = localFieldPairs.fields.includes(field);
                    return (
                      <label
                        key={field}
                        className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-white hover:shadow-sm p-1.5 rounded-md transition-all border border-transparent hover:border-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const nextFields = [...localFieldPairs.fields];
                            const nextOutputVars = [...localFieldPairs.outputVars];
                            if (e.target.checked) {
                              if (!nextFields.includes(field)) {
                                nextFields.push(field);
                                nextOutputVars.push(field);
                              }
                            } else {
                              const idx = nextFields.indexOf(field);
                              if (idx !== -1) {
                                nextFields.splice(idx, 1);
                                nextOutputVars.splice(idx, 1);
                              }
                            }
                            updateLocalFieldPairs(nextFields, nextOutputVars);
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all appearance-none border-2 checked:bg-indigo-600 checked:border-indigo-600"
                        />
                        <span className="truncate font-medium" title={field}>
                          {field}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-[10px] text-gray-400 italic py-4 text-center">
                    No persisted fields found in flow
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 italic px-1">
                Select fields to automatically add them to the local storage mapping.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Fields & Output Vars</label>
                <button
                  type="button"
                  className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 font-semibold"
                  onClick={() => {
                    const nextFields = [...localFieldPairs.fields, ""];
                    const nextOutputVars = [...localFieldPairs.outputVars, ""];
                    updateLocalFieldPairs(nextFields, nextOutputVars);
                  }}
                  title="Add field"
                >
                  + Add
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {localFieldPairs.fields.map((fieldValue, idx) => (
                  <div
                    key={`local-field-${idx}`}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                  >
                    <input
                      className="w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                      placeholder="Field (e.g. accessToken)"
                      value={fieldValue}
                      onChange={(e) => {
                        const nextFields = [...localFieldPairs.fields];
                        const nextOutputVars = [...localFieldPairs.outputVars];
                        const previousField = nextFields[idx] ?? "";
                        const previousOutput = nextOutputVars[idx] ?? "";

                        nextFields[idx] = e.target.value;
                        if (previousOutput === "" || previousOutput === previousField) {
                          nextOutputVars[idx] = e.target.value;
                        }
                        updateLocalFieldPairs(nextFields, nextOutputVars);
                      }}
                    />
                    <input
                      className="w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                      placeholder="Output var (e.g. token)"
                      value={localFieldPairs.outputVars[idx] ?? ""}
                      onChange={(e) => {
                        const nextOutputVars = [...localFieldPairs.outputVars];
                        nextOutputVars[idx] = e.target.value;
                        updateLocalFieldPairs(localFieldPairs.fields, nextOutputVars);
                      }}
                    />
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-500 px-2"
                      onClick={() => {
                        const nextFields = localFieldPairs.fields.filter((_, i) => i !== idx);
                        const nextOutputVars = localFieldPairs.outputVars.filter(
                          (_, i) => i !== idx
                        );
                        if (nextFields.length === 0) {
                          updateLocalFieldPairs([""], [""]);
                          return;
                        }
                        updateLocalFieldPairs(nextFields, nextOutputVars);
                      }}
                      title="Remove field"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Format</label>
                <select
                  className="mt-2 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
                  value={String(node.data.format ?? "indexedList")}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      format: e.target.value as "indexedList" | "singleValue",
                    })
                  }
                >
                  <option value="indexedList">indexedList</option>
                  <option value="singleValue">singleValue</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {sourceMode === "ws" && (
        <>
          <WebSocketPanel
            wsCurlText={wsCurlText}
            url={wsUrl}
            protocolsText={wsProtocolsText}
            draftMessage={wsDraftMessage}
            latestResponse={latestWsIncomingMessage}
            isConnected={wsConnectionState === "connected"}
            connectionState={wsConnectionState}
            messages={wsMessages}
            onWsCurlChange={(value) => {
              setWsCurlText(value);
              updateNodeData(node.id, { wsCurl: value, requestSource: "ws" });
            }}
            onImportWsCurl={() => {
              const parsed = parseWsCurl(wsCurlText);
              if (!parsed || !parsed.url) {
                updateResponse(node.id, {
                  error: "Invalid curl input. Paste a curl command with a websocket URL.",
                });
                return;
              }
              setWsUrl(parsed.url);
              setWsProtocolsText(parsed.protocols.join(", "));
              updateNodeData(node.id, {
                requestSource: "ws",
                wsCurl: wsCurlText,
                wsUrl: parsed.url,
                wsProtocols: parsed.protocols,
              });
              updateResponse(node.id, { error: null });
            }}
            onUrlChange={(value) => {
              setWsUrl(value);
              updateNodeData(node.id, { wsUrl: value, requestSource: "ws" });
            }}
            onProtocolsChange={(value) => {
              setWsProtocolsText(value);
              updateNodeData(node.id, {
                wsProtocols: parseWsProtocols(value),
                requestSource: "ws",
              });
            }}
            onDraftMessageChange={(value) => {
              setWsDraftMessage(value);
              updateNodeData(node.id, { wsMessage: value, requestSource: "ws" });
            }}
            onConnect={connectWebSocket}
            onDisconnect={() => disconnectWebSocket("Disconnected by user")}
            onSend={sendWebSocketMessage}
            onClearMessages={() => {
              setWsMessages([]);
              updateNodeData(node.id, { wsLastMessage: "" });
            }}
          />
        </>
      )}
    </div>
  );
}
