"use client";

import * as React from "react";
import NodeNameInput from "./NodeNameInput";
import TargetNodeDisplay from "./TargetNodeDisplay";
import ParamsEditor from "./action/ParamsEditor";
import HeadersEditor from "./action/HeadersEditor";
import BodyEditor from "./action/BodyEditor";

type RouterSessionMode = "required" | "optional" | "disabled";

type RouterInspectorProps = {
  node: {
    id: string;
    data: {
      name?: string;
      url?: string;
      method?: string;
      sessionMode?: RouterSessionMode;
      responseMapping?: Record<string, string>;
      persistResponseMappingKeys?: string[];
      maskedResponseMappingKeys?: string[];
      inputManagerSaveSessionId?: string;
      headers?: Record<string, unknown>;
      apiBody?: Record<string, unknown>;
      apiBodyRaw?: string;
      bodyMode?: "json" | "soap" | "form";
      nextNode?: string | RouterNextNode;
      extractUrlPathSegment?: boolean;
    };
  };
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

type RouterRoute = {
  when?: { eq?: [string, string] };
  goto?: string;
  toMainMenu?: boolean;
  isGoBack?: boolean;
  goBackTarget?: string;
  goBackToFlow?: string;
};

type RouterNextNode = {
  routes?: RouterRoute[];
  default?: string;
  defaultId?: string;
};

type KeyValueRow = {
  id: string;
  key: string;
  value: string;
};

type FormFieldRow = {
  id: string;
  key: string;
  value: string;
  description: string;
};

type MappingRow = {
  id: string;
  key: string;
  value: string;
  persist: boolean;
  mask: boolean;
};

const SESSION_MODE_OPTIONS: Array<{
  value: RouterSessionMode;
  label: string;
  description: string;
}> = [
  {
    value: "required",
    label: "Required",
    description: "Always load or create session state.",
  },
  {
    value: "optional",
    label: "Optional",
    description: "Use session only when one is supplied.",
  },
  {
    value: "disabled",
    label: "Disabled",
    description: "Skip Redis and run this route statelessly.",
  },
];

export default function RouterInspector({
  node,
  updateNodeData,
}: RouterInspectorProps) {
  const bodyMode = (node.data.bodyMode as "json" | "soap" | "form") ?? "json";
  const rawNextNode = node.data?.nextNode;
  const nextNode =
    typeof rawNextNode === "string"
      ? {
          routes: [],
          default: rawNextNode,
          defaultId: rawNextNode,
        }
      : ((rawNextNode as RouterNextNode) || {
          routes: [],
          default: "",
          defaultId: "",
        });
  const routes = nextNode.routes || [];
  const defaultRoute = nextNode.defaultId || nextNode.default || "";
  const sessionMode =
    node.data.sessionMode === "optional" || node.data.sessionMode === "disabled"
      ? node.data.sessionMode
      : "required";
  const [activeSection, setActiveSection] = React.useState<
    "params" | "headers" | "body" | "requestMapping" | "routing"
  >("params");

  const createKeyValueRow = React.useCallback((key = "", value = ""): KeyValueRow => {
    const stableId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `router-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return { id: stableId, key, value };
  }, []);

  const buildParamRowsFromUrl = React.useCallback(
    (rawUrl: string): KeyValueRow[] => {
      try {
        const url = new URL(rawUrl, "http://router.local");
        return Array.from(url.searchParams.entries()).map(([key, value]) =>
          createKeyValueRow(key, value)
        );
      } catch {
        const queryIndex = rawUrl.indexOf("?");
        if (queryIndex === -1) return [];
        const query = rawUrl.slice(queryIndex + 1);
        const searchParams = new URLSearchParams(query);
        return Array.from(searchParams.entries()).map(([key, value]) =>
          createKeyValueRow(key, value)
        );
      }
    },
    [createKeyValueRow]
  );

  const ensureFormRows = React.useCallback((rows: FormFieldRow[]): FormFieldRow[] => {
    return rows.length > 0 ? rows : [{ id: createKeyValueRow().id, key: "", value: "", description: "" }];
  }, [createKeyValueRow]);

  const parseFormEncodedBody = React.useCallback(
    (text: string): FormFieldRow[] => {
      if (!text.trim()) return [];
      const params = new URLSearchParams(text);
      return Array.from(params.entries()).map(([key, value]) => ({
        id: createKeyValueRow().id,
        key,
        value,
        description: "",
      }));
    },
    [createKeyValueRow]
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

  const [paramRows, setParamRows] = React.useState<KeyValueRow[]>(() =>
    buildParamRowsFromUrl(String(node.data.url ?? ""))
  );
  const [headerRows, setHeaderRows] = React.useState<KeyValueRow[]>(() =>
    Object.entries(node.data.headers || {}).map(([key, value]) =>
      createKeyValueRow(key, String(value ?? ""))
    )
  );
  const [apiBodyText, setApiBodyText] = React.useState<string>(() => {
    if (bodyMode === "soap" || bodyMode === "form") {
      return String(node.data.apiBodyRaw ?? "");
    }
    return JSON.stringify(node.data.apiBody ?? {}, null, 2);
  });
  const [apiBodyError, setApiBodyError] = React.useState<string | null>(null);
  const [formFields, setFormFields] = React.useState<FormFieldRow[]>(() =>
    ensureFormRows(parseFormEncodedBody(String(node.data.apiBodyRaw ?? "")))
  );
  const urlSignature = React.useMemo(() => String(node.data.url ?? ""), [node.data.url]);
  const headersSignature = React.useMemo(
    () => JSON.stringify(node.data.headers || {}),
    [node.data.headers]
  );
  const lastUrlSignatureRef = React.useRef(urlSignature);
  const lastHeadersSignatureRef = React.useRef(headersSignature);
  const toMappingRows = React.useCallback(() => {
    const mapping = node.data.responseMapping || {};
    const persisted = new Set(node.data.persistResponseMappingKeys || []);
    const masked = new Set(node.data.maskedResponseMappingKeys || []);
    return Object.entries(mapping).map(([key, value], idx) => ({
      id: `map-init-${idx}`,
      key,
      value: String(value ?? ""),
      persist: persisted.has(key),
      mask: masked.has(key),
    }));
  }, [node.data.maskedResponseMappingKeys, node.data.persistResponseMappingKeys, node.data.responseMapping]);
  const [mappingRows, setMappingRows] = React.useState<MappingRow[]>(toMappingRows);

  React.useEffect(() => {
    if (lastUrlSignatureRef.current === urlSignature) {
      return;
    }

    lastUrlSignatureRef.current = urlSignature;
    setParamRows(buildParamRowsFromUrl(urlSignature));
  }, [buildParamRowsFromUrl, urlSignature]);

  React.useEffect(() => {
    if (lastHeadersSignatureRef.current === headersSignature) {
      return;
    }

    lastHeadersSignatureRef.current = headersSignature;
    setHeaderRows(
      Object.entries(node.data.headers || {}).map(([key, value]) =>
        createKeyValueRow(key, String(value ?? ""))
      )
    );
  }, [createKeyValueRow, headersSignature, node.data.headers]);

  React.useEffect(() => {
    const currentUrl = String(node.data.url ?? "");
    const query = new URLSearchParams();
    paramRows.forEach((row) => {
      const key = row.key.trim();
      if (!key) return;
      query.append(key, row.value);
    });

    const queryString = query.toString();
    const [base] = currentUrl.split("?");
    const nextUrl = queryString ? `${base}?${queryString}` : base;

    if (nextUrl === currentUrl) {
      lastUrlSignatureRef.current = currentUrl;
      return;
    }

    lastUrlSignatureRef.current = nextUrl;
    updateNodeData(node.id, { url: nextUrl });
  }, [node.data.url, node.id, paramRows, updateNodeData]);

  React.useEffect(() => {
    const headers = headerRows.reduce<Record<string, string>>((acc, row) => {
      const key = row.key.trim();
      if (!key) return acc;
      acc[key] = row.value;
      return acc;
    }, {});

    const nextSignature = JSON.stringify(headers);
    if (nextSignature === headersSignature) {
      lastHeadersSignatureRef.current = headersSignature;
      return;
    }

    lastHeadersSignatureRef.current = nextSignature;
    updateNodeData(node.id, { headers });
  }, [headerRows, headersSignature, node.id, updateNodeData]);

  React.useEffect(() => {
    if (bodyMode === "soap" || bodyMode === "form") {
      const rawBody = String(node.data.apiBodyRaw ?? "");
      setApiBodyText(rawBody);
      if (bodyMode === "form") {
        setFormFields(ensureFormRows(parseFormEncodedBody(rawBody)));
      }
      setApiBodyError(null);
      return;
    }

    setApiBodyText(JSON.stringify(node.data.apiBody ?? {}, null, 2));
    setApiBodyError(null);
  }, [bodyMode, ensureFormRows, node.data.apiBody, node.data.apiBodyRaw, parseFormEncodedBody]);

  const responseMappingSignature = React.useMemo(
    () =>
      JSON.stringify({
        mapping: node.data.responseMapping || {},
        persist: node.data.persistResponseMappingKeys || [],
        mask: node.data.maskedResponseMappingKeys || [],
      }),
    [
      node.data.maskedResponseMappingKeys,
      node.data.persistResponseMappingKeys,
      node.data.responseMapping,
    ]
  );
  const lastResponseMappingSignatureRef = React.useRef(responseMappingSignature);

  React.useEffect(() => {
    if (lastResponseMappingSignatureRef.current === responseMappingSignature) {
      return;
    }

    lastResponseMappingSignatureRef.current = responseMappingSignature;
    setMappingRows(toMappingRows());
  }, [responseMappingSignature, toMappingRows]);

  const commitResponseMapping = React.useCallback(
    (rows: MappingRow[]) => {
      const nextMapping: Record<string, string> = {};
      const nextPersistKeys: string[] = [];
      const nextMaskedKeys: string[] = [];
      rows.forEach((row) => {
        const key = row.key.trim();
        if (!key) return;
        nextMapping[key] = row.value;
        if (row.persist) {
          nextPersistKeys.push(key);
        }
        if (row.mask) {
          nextMaskedKeys.push(key);
        }
      });
      lastResponseMappingSignatureRef.current = JSON.stringify({
        mapping: nextMapping,
        persist: nextPersistKeys,
        mask: nextMaskedKeys,
      });
      updateNodeData(node.id, {
        responseMapping: Object.keys(nextMapping).length > 0 ? nextMapping : {},
        persistResponseMappingKeys: nextPersistKeys,
        maskedResponseMappingKeys: nextMaskedKeys,
      });
    },
    [node.id, updateNodeData]
  );

  const updateRoutes = (newRoutes: RouterRoute[]) => {
    updateNodeData(node.id, {
      nextNode: {
        ...nextNode,
        routes: newRoutes,
      },
    });
  };

  const addRoute = () => {
    updateRoutes([
      ...routes,
      {
        when: { eq: ["", ""] },
        goto: "",
      },
    ]);
  };

  const removeRoute = (idx: number) => {
    updateRoutes(routes.filter((_: RouterRoute, i: number) => i !== idx));
  };

  const updateRoute = (
    idx: number,
    updater: (route: RouterRoute) => RouterRoute
  ) => {
    const nextRoutes = [...routes];
    nextRoutes[idx] = updater(nextRoutes[idx] || {});
    updateRoutes(nextRoutes);
  };

  const addParam = () => {
    setParamRows((prev) => [...prev, createKeyValueRow()]);
  };

  const removeParam = (id: string) => {
    setParamRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateParam = (id: string, key: string, value: string) => {
    setParamRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, key, value } : row))
    );
  };

  const addHeader = () => {
    setHeaderRows((prev) => [...prev, createKeyValueRow()]);
  };

  const removeHeader = (id: string) => {
    setHeaderRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateHeader = (id: string, key: string, value: string) => {
    setHeaderRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, key, value } : row))
    );
  };

  const addFormField = () => {
    setFormFields((prev) => [...prev, { id: createKeyValueRow().id, key: "", value: "", description: "" }]);
  };

  const removeFormField = (id: string) => {
    setFormFields((prev) => {
      const next = ensureFormRows(prev.filter((row) => row.id !== id));
      const encoded = serializeFormEncodedBody(next);
      setApiBodyText(encoded);
      updateNodeData(node.id, { apiBodyRaw: encoded });
      return next;
    });
  };

  const updateFormField = (
    id: string,
    field: "key" | "value" | "description",
    value: string
  ) => {
    setFormFields((prev) => {
      const next = prev.map((row) => (row.id === id ? { ...row, [field]: value } : row));
      const encoded = serializeFormEncodedBody(next);
      setApiBodyText(encoded);
      updateNodeData(node.id, { apiBodyRaw: encoded });
      return next;
    });
  };

  const addMappingRow = () => {
    setMappingRows((prev) => [
      ...prev,
        {
          id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          key: "",
          value: "",
          persist: false,
          mask: false,
        },
    ]);
  };

  const removeMappingRow = (idx: number) => {
    const next = mappingRows.filter((_, i) => i !== idx);
    setMappingRows(next);
    commitResponseMapping(next);
  };

  const updateMappingRow = (
    idx: number,
    patch: Partial<Omit<MappingRow, "id">>
  ) => {
    const next = [...mappingRows];
    next[idx] = { ...next[idx], ...patch };
    setMappingRows(next);
    commitResponseMapping(next);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <NodeNameInput
          nodeId={node.id}
          name={String(node.data.name ?? "")}
          onNameChange={(val) => updateNodeData(node.id, { name: val })}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
              Method
            </label>
            <select
              className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-amber-500 transition-all text-gray-900 cursor-pointer"
              value={String(node.data.method ?? "POST")}
              onChange={(e) => updateNodeData(node.id, { method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
              URL
            </label>
            <input
              className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-amber-500 transition-all text-gray-900"
              value={String(node.data.url ?? "")}
              onChange={(e) => updateNodeData(node.id, { url: e.target.value })}
              placeholder="/api/menu/nav"
            />
          </div>
        </div>

        {/* URL Path Segment Extraction */}
        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={Boolean(node.data.extractUrlPathSegment)}
            onChange={(e) =>
              updateNodeData(node.id, { extractUrlPathSegment: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-xs font-medium text-gray-700 group-hover:text-amber-700 transition-colors">
            Extract last URL path segment
          </span>
          {node.data.extractUrlPathSegment && (
            <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
              → request.body.urlPathExtract
            </span>
          )}
        </label>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
            Session Type
          </label>
          <select
            className="w-full text-sm border-2 border-gray-100 rounded-lg bg-gray-50/50 px-3 py-2 focus:outline-none focus:border-amber-500 transition-all text-gray-900 cursor-pointer"
            value={sessionMode}
            onChange={(e) =>
              updateNodeData(node.id, {
                sessionMode: e.target.value as RouterSessionMode,
              })
            }
          >
            {SESSION_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1.5">
            {
              SESSION_MODE_OPTIONS.find((option) => option.value === sessionMode)
                ?.description
            }
          </p>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
          {[
            { key: "params", label: "Params" },
            { key: "headers", label: "Headers" },
            { key: "body", label: "Body" },
            { key: "requestMapping", label: "Request Mapping" },
            { key: "routing", label: "Router Rules" },
          ].map((section) => (
            <button
              key={section.key}
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                activeSection === section.key
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick={() =>
                setActiveSection(
                  section.key as "params" | "headers" | "body" | "requestMapping" | "routing"
                )
              }
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {activeSection === "params" && (
            <ParamsEditor
              params={paramRows}
              onAdd={addParam}
              onRemove={removeParam}
              onUpdate={updateParam}
            />
          )}

          {activeSection === "headers" && (
            <HeadersEditor
              headers={headerRows}
              onAdd={addHeader}
              onRemove={removeHeader}
              onUpdate={updateHeader}
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
                  const nextFormFields = ensureFormRows(parseFormEncodedBody(apiBodyText));
                  setFormFields(nextFormFields);
                  const encoded = serializeFormEncodedBody(nextFormFields);
                  setApiBodyText(encoded);
                  updateNodeData(node.id, { apiBodyRaw: encoded });
                  setApiBodyError(null);
                  return;
                }

                try {
                  const parsed = JSON.parse(apiBodyText || "{}") as Record<string, unknown>;
                  updateNodeData(node.id, { apiBody: parsed });
                  setApiBodyError(null);
                } catch (error) {
                  setApiBodyError(error instanceof Error ? error.message : "Invalid JSON");
                }
              }}
              onApiBodyChange={(value) => {
                setApiBodyText(value);
                if (bodyMode === "soap") {
                  updateNodeData(node.id, { apiBodyRaw: value });
                  setApiBodyError(null);
                  return;
                }
                if (bodyMode === "form") {
                  updateNodeData(node.id, { apiBodyRaw: value });
                  setApiBodyError(null);
                  return;
                }
                try {
                  const parsed = JSON.parse(value || "{}") as Record<string, unknown>;
                  updateNodeData(node.id, { apiBody: parsed });
                  setApiBodyError(null);
                } catch (error) {
                  setApiBodyError(error instanceof Error ? error.message : "Invalid JSON");
                }
              }}
              onAddFormField={addFormField}
              onRemoveFormField={removeFormField}
              onUpdateFormField={updateFormField}
            />
          )}

          {activeSection === "requestMapping" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-bold text-gray-800">Request Mapping</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Map request keys to template expressions
                  </p>
                </div>
                <button
                  onClick={addMappingRow}
                  className="text-xs bg-gradient-to-r from-amber-600 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-amber-700 hover:to-orange-600 transition-all shadow-sm font-medium cursor-pointer"
                >
                  + Add Mapping
                </button>
              </div>

              <div className="space-y-2">
                {mappingRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center p-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <div className="space-y-2">
                      <input
                        className="w-full text-sm p-2 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-gray-800 transition-all"
                        placeholder="requestAmount"
                        value={row.key}
                        onChange={(e) => updateMappingRow(idx, { key: e.target.value })}
                      />
                      <label className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-600">
                        <input
                          type="checkbox"
                          checked={row.persist}
                          onChange={(e) => updateMappingRow(idx, { persist: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        Persist to Input Manager
                      </label>
                      <label className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-600">
                        <input
                          type="checkbox"
                          checked={row.mask}
                          onChange={(e) => updateMappingRow(idx, { mask: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        Mask in Logs
                      </label>
                    </div>
                    <input
                      className="w-full text-sm p-2 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none font-mono text-gray-800 transition-all"
                      placeholder="{{request.body.amount}}"
                      value={row.value}
                      onChange={(e) => updateMappingRow(idx, { value: e.target.value })}
                    />
                    <button
                      onClick={() => removeMappingRow(idx)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                      title="Remove mapping"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}

                {mappingRows.length === 0 ? (
                  <div className="text-xs text-gray-400 italic p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                    No mappings added.
                  </div>
                ) : null}

                {mappingRows.some((row) => row.persist) ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <label className="text-[10px] font-bold text-amber-700 uppercase mb-1 block">
                      Input Manager Session ID
                    </label>
                    <input
                      className="w-full text-sm p-2 rounded-lg border-2 border-amber-200 bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none font-mono text-gray-800 transition-all"
                      placeholder="{{request.body.uuid}}"
                      value={String(node.data.inputManagerSaveSessionId ?? "")}
                      onChange={(e) =>
                        updateNodeData(node.id, { inputManagerSaveSessionId: e.target.value })
                      }
                    />
                    <div className="mt-1 text-[11px] text-amber-700/80">
                      Accepts literals or request templates like <span className="font-mono">{`{{request.body.uuid}}`}</span>.
                      Leave empty to use the router session.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeSection === "routing" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-sm font-bold text-gray-800">Router Rules</label>
                  <p className="text-xs text-gray-500 mt-0.5">Evaluated top to bottom</p>
                </div>
                <button
                  onClick={addRoute}
                  className="text-xs bg-gradient-to-r from-amber-600 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-amber-700 hover:to-orange-600 transition-all shadow-sm font-medium cursor-pointer"
                >
                  + Add Route
                </button>
              </div>

              <div className="space-y-3">
                {routes.map((route, idx) => {
                  const when = route.when || {};
                  const operatorKey =
                    (Object.keys(when)[0] as "eq" | "ne" | "like" | "contains" | undefined) ||
                    "eq";
                  const operator = operatorKey === "contains" ? "like" : operatorKey;
                  const operands =
                    (when as Record<string, [string, string]>)[operatorKey] ||
                    (when as Record<string, [string, string]>)[operator];
                  const left = operands?.[0] || "";
                  const displayLeft = left === "{{http.body.input}}" ? "" : left;
                  const right = operands?.[1] || "";

                  return (
                    <div
                      key={idx}
                      className="p-4 bg-gradient-to-br from-white to-gray-50/50 border-2 border-gray-200 rounded-xl relative group transition-all hover:border-amber-300 hover:shadow-lg"
                    >
                      <button
                        onClick={() => removeRoute(idx)}
                        className="absolute top-3 right-3 text-gray-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 rounded-md cursor-pointer"
                        title="Remove Route"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>

                      <div className="grid grid-cols-[1fr_120px_1fr] gap-2 pr-8 mb-3 items-end">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                            Input Source
                          </label>
                          <input
                            className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none font-mono text-gray-800 bg-white shadow-sm transition-all"
                            value={displayLeft}
                            placeholder="{{http.body.input}}"
                            onChange={(e) =>
                              updateRoute(idx, (r) => ({
                                ...r,
                                when: { [operator]: [e.target.value, right] },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                            Operator
                          </label>
                          <select
                            className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-gray-800 bg-white shadow-sm transition-all cursor-pointer"
                            value={operator}
                            onChange={(e) =>
                              updateRoute(idx, (r) => ({
                                ...r,
                                when: { [e.target.value]: [left, right] },
                              }))
                            }
                          >
                            <option value="like">Like</option>
                            <option value="eq">Equals</option>
                            <option value="ne">Not Equals</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                            Match Input
                          </label>
                          <input
                            className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none font-mono text-gray-800 bg-white shadow-sm transition-all"
                            value={right}
                            placeholder="00"
                            onChange={(e) =>
                              updateRoute(idx, (r) => ({
                                ...r,
                                when: { [operator]: [left, e.target.value] },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200/70">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2 block">
                          Target
                        </label>
                        <TargetNodeDisplay
                          nodeId={String(route.goto || "")}
                          label=""
                          title="Connect this route handle on the canvas to set destination"
                        />
                      </div>
                    </div>
                  );
                })}

                {routes.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-white">
                    <div className="text-sm text-gray-600 font-semibold">No router rules yet</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Add a route to start routing by input value
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t-2 border-gray-100 pt-6">
        <div className="mb-3">
          <label className="text-sm font-bold text-gray-800 block">Default Route</label>
          <p className="text-xs text-gray-500 mt-0.5">Used when no route matches</p>
        </div>
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 rounded-xl border-2 border-gray-200 shadow-sm">
          <TargetNodeDisplay
            nodeId={defaultRoute}
            label=""
            title="Connect the default handle on the canvas to set fallback destination"
          />
        </div>
      </div>
    </div>
  );
}
