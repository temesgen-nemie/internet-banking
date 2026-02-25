"use client";

import { useState } from "react";
import NodeNameInput from "./NodeNameInput";
import TargetNodeDisplay from "./TargetNodeDisplay";

type RouterInspectorProps = {
  node: {
    id: string;
    data: {
      name?: string;
      url?: string;
      method?: string;
      responseMapping?: Record<string, string>;
      nextNode?: RouterNextNode;
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
};

type MappingRow = {
  id: string;
  key: string;
  value: string;
};

export default function RouterInspector({
  node,
  updateNodeData,
}: RouterInspectorProps) {
  const nextNode = ((node.data?.nextNode as RouterNextNode) || {
    routes: [],
    default: "",
  }) as RouterNextNode;
  const routes = nextNode.routes || [];
  const defaultRoute = nextNode.default || "";

  const toMappingRows = () => {
    const mapping = node.data.responseMapping || {};
    return Object.entries(mapping).map(([key, value], idx) => ({
      id: `map-init-${idx}-${key}`,
      key,
      value: String(value ?? ""),
    }));
  };
  const [mappingRows, setMappingRows] = useState<MappingRow[]>(toMappingRows);

  const commitResponseMapping = (rows: MappingRow[]) => {
    const nextMapping: Record<string, string> = {};
    rows.forEach((row) => {
      const key = row.key.trim();
      if (!key) return;
      nextMapping[key] = row.value;
    });
    updateNodeData(node.id, {
      responseMapping: Object.keys(nextMapping).length > 0 ? nextMapping : {},
    });
  };

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
        when: { eq: ["{{http.body.input}}", ""] },
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

  const addMappingRow = () => {
    setMappingRows((prev) => [
      ...prev,
      {
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        key: "",
        value: "",
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
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="text-sm font-bold text-gray-800">Request Mapping</label>
            <p className="text-xs text-gray-500 mt-0.5">Map request keys to template expressions</p>
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
              <input
                className="w-full text-sm p-2 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-gray-800 transition-all"
                placeholder="requestAmount"
                value={row.key}
                onChange={(e) => updateMappingRow(idx, { key: e.target.value })}
              />
              <input
                className="w-full text-sm p-2 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none font-mono text-gray-800 transition-all"
                placeholder="{{number:http.body.amount}}"
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
        </div>
      </div>

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
            const left = route.when?.eq?.[0] || "{{http.body.input}}";
            const right = route.when?.eq?.[1] || "";
            const isGoBack = Boolean(route.isGoBack);
            const isMainMenu = Boolean(route.toMainMenu);

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

                <div className="grid grid-cols-2 gap-2 pr-8 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      Input Source
                    </label>
                    <input
                      className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none font-mono text-gray-800 bg-white shadow-sm transition-all"
                      value={left}
                      onChange={(e) =>
                        updateRoute(idx, (r) => ({
                          ...r,
                          when: { eq: [e.target.value, right] },
                        }))
                      }
                    />
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
                          when: { eq: [left, e.target.value] },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={isMainMenu}
                      onChange={(e) =>
                        updateRoute(idx, (r) => ({
                          ...r,
                          toMainMenu: e.target.checked,
                          isGoBack: e.target.checked ? false : r.isGoBack,
                          goto: e.target.checked ? "" : r.goto,
                        }))
                      }
                    />
                    To Main Menu
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={isGoBack}
                      onChange={(e) =>
                        updateRoute(idx, (r) => ({
                          ...r,
                          isGoBack: e.target.checked,
                          toMainMenu: e.target.checked ? false : r.toMainMenu,
                          goto: e.target.checked ? "" : r.goto,
                        }))
                      }
                    />
                    Go Back
                  </label>
                </div>

                {isGoBack ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                        Go Back Target
                      </label>
                      <input
                        className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-gray-800 bg-white shadow-sm transition-all"
                        value={String(route.goBackTarget || "")}
                        placeholder="PreviousStep"
                        onChange={(e) =>
                          updateRoute(idx, (r) => ({
                            ...r,
                            goBackTarget: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                        Go Back Flow
                      </label>
                      <input
                        className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-gray-800 bg-white shadow-sm transition-all"
                        value={String(route.goBackToFlow || "")}
                        placeholder="Transfers"
                        onChange={(e) =>
                          updateRoute(idx, (r) => ({
                            ...r,
                            goBackToFlow: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : isMainMenu ? null : (
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
                )}
              </div>
            );
          })}

          {routes.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-white">
              <div className="text-sm text-gray-600 font-semibold">No router rules yet</div>
              <div className="text-xs text-gray-400 mt-1">Add a route to start routing by input value</div>
            </div>
          ) : null}
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
