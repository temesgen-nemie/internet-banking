"use client";

import NodeNameInput from "./NodeNameInput";
import TargetNodeDisplay from "./TargetNodeDisplay";

type ConditionInspectorProps = {
  node: any;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
};

type Operand = string | number | boolean | null;

type LeafOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "matches"
  | "contains"
  | "exists";

type GroupOp = "or" | "and";

type UiExpr =
  | {
      kind: "cond";
      op: LeafOp;
      left: string;
      right: string;
      negate: boolean;
    }
  | {
      kind: "group";
      op: GroupOp;
      items: UiExpr[];
      negate: boolean;
    };

type ConditionRoute = {
  when?: Record<string, unknown>;
  goto?: string;
};

const defaultExpr = (): UiExpr => ({ kind: "cond", op: "eq", left: "", right: "", negate: false });

function ConditionExprEditor({
  value,
  onChange,
  depth,
}: {
  value: UiExpr;
  onChange: (next: UiExpr) => void;
  depth: number;
}) {
  const indent = depth * 12;

  const header = (
    <div className="flex items-center gap-2" style={{ paddingLeft: indent }}>
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Type</label>
      <select
        className="text-xs px-2 py-2 rounded-lg border-2 border-gray-200 bg-white font-bold text-gray-700 cursor-pointer hover:border-pink-300 focus:outline-none focus:ring-4 focus:ring-pink-100 shadow-sm transition-all"
        value={value.kind === "group" ? value.op : "single"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "single") {
            if (value.kind === "cond") return;
            const first = value.items[0] || defaultExpr();
            onChange(first);
            return;
          }
          const op = v as GroupOp;
          if (value.kind === "group") {
            onChange({ ...value, op });
            return;
          }
          onChange({ kind: "group", op, items: [value, defaultExpr()], negate: false });
        }}
      >
        <option value="single">Single</option>
        <option value="or">OR group</option>
        <option value="and">AND group</option>
      </select>
    </div>
  );

  if (value.kind === "group") {
    return (
      <div className="space-y-2">
        {header}
        <div style={{ paddingLeft: indent }} className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[10px] text-gray-600 font-semibold select-none">
            <input
              type="checkbox"
              checked={value.negate}
              onChange={(e) => onChange({ ...value, negate: e.target.checked })}
            />
            NOT (negate group)
          </label>
        </div>

        <div className="space-y-2">
          {value.items.map((child, childIdx) => (
            <div
              key={childIdx}
              className="relative rounded-lg border border-gray-200 bg-white/60 p-2"
              style={{ marginLeft: indent }}
            >
              <button
                className="absolute top-1.5 right-1.5 text-gray-300 hover:text-red-500 p-1 transition-all hover:bg-red-50 rounded-md"
                title="Remove item"
                onClick={() => {
                  const nextItems = value.items.filter((_, i) => i !== childIdx);
                  onChange({ ...value, items: nextItems.length ? nextItems : [defaultExpr()] });
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              <ConditionExprEditor
                value={child}
                depth={depth + 1}
                onChange={(nextChild) => {
                  const nextItems = [...value.items];
                  nextItems[childIdx] = nextChild;
                  onChange({ ...value, items: nextItems });
                }}
              />
            </div>
          ))}

          <button
            className="text-xs bg-white border border-gray-200 hover:border-pink-300 hover:bg-pink-50 text-gray-700 px-3 py-2 rounded-lg transition-all shadow-sm font-medium"
            style={{ marginLeft: indent }}
            onClick={() => onChange({ ...value, items: [...value.items, defaultExpr()] })}
          >
            + Add condition
          </button>
        </div>
      </div>
    );
  }

  const isExists = value.op === "exists";

  return (
    <div className="space-y-2">
      {header}
      <div className="flex gap-2.5 items-end" style={{ paddingLeft: indent }}>
        <div className="flex-1">
          <div className="text-[10px] text-gray-500 mb-1.5 ml-1 font-semibold">Left operand</div>
          <input
            className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-pink-400 focus:ring-4 focus:ring-pink-100 outline-none font-mono text-gray-800 placeholder-gray-400 bg-white shadow-sm transition-all"
            placeholder="{{vars.serviceKey}}"
            value={value.left}
            onChange={(e) => onChange({ ...value, left: e.target.value })}
          />
        </div>

        <div className="pb-0.5">
          <select
            className="text-xs px-2 py-2.5 rounded-lg border-2 border-pink-300 bg-gradient-to-b from-white to-pink-50 font-bold text-pink-600 cursor-pointer hover:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-100 min-w-[120px] shadow-sm transition-all"
            value={value.op}
            onChange={(e) =>
              onChange({
                ...value,
                op: e.target.value as LeafOp,
                right: e.target.value === "exists" ? "" : value.right,
              })
            }
          >
            <option value="eq">= (equals)</option>
            <option value="ne">!= (not equals)</option>
            <option value="gt">&gt; (greater than)</option>
            <option value="gte">&gt;= (greater or equal)</option>
            <option value="lt">&lt; (less than)</option>
            <option value="lte">&lt;= (less or equal)</option>
            <option value="like">LIKE (wildcard)</option>
            <option value="matches">MATCHES (regex)</option>
            <option value="contains">CONTAINS</option>
            <option value="exists">EXISTS (has value)</option>
          </select>
        </div>

        <div className="flex-1">
          <div className="text-[10px] text-gray-500 mb-1.5 ml-1 font-semibold">Right operand</div>
          <input
            className="w-full text-sm p-2.5 rounded-lg border-2 border-gray-200 focus:border-pink-400 focus:ring-4 focus:ring-pink-100 outline-none font-mono text-gray-800 placeholder-gray-400 bg-white shadow-sm transition-all disabled:bg-gray-50 disabled:text-gray-400"
            placeholder='"" or null or {{vars.max}}'
            value={value.right}
            disabled={isExists}
            onChange={(e) => onChange({ ...value, right: e.target.value })}
          />
        </div>
      </div>

      <div
        style={{ paddingLeft: indent }}
        className="flex items-center gap-3 text-[10px] text-gray-600 font-semibold"
      >
        <label className="flex items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={value.negate}
            onChange={(e) => onChange({ ...value, negate: e.target.checked })}
          />
          NOT (negate)
        </label>
        <div className="ml-auto text-[10px] text-gray-500 font-mono">Use `null` to send JSON null</div>
      </div>
    </div>
  );
}

export default function ConditionInspector({
  node,
  updateNodeData,
}: ConditionInspectorProps) {
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  const toText = (value: unknown, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  };

  const operandToText = (value: unknown): string => {
    if (value === null) return "null";
    if (value === true) return "true";
    if (value === false) return "false";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;
    return toText(value, "");
  };

  const parseOperandText = (raw: string): Operand | string => {
    const trimmed = raw.trim();
    if (trimmed === "") return "";
    if (trimmed === "null") return null;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    // Avoid "helpfully" parsing template strings like {{vars.x}}
    if (!trimmed.includes("{{") && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return raw;
  };

  const parseWhenToUi = (when: unknown): UiExpr => {
    const fallback = defaultExpr();
    if (!isRecord(when)) return fallback;

    // { not: <expr> }
    if ("not" in when) {
      const inner = parseWhenToUi((when as any).not);
      return { ...inner, negate: true };
    }

    const keys = Object.keys(when);
    if (keys.length !== 1) return fallback;
    const op = keys[0] as string;
    const value = when[op];

    if (op === "or" || op === "and") {
      const arr = Array.isArray(value) ? value : [];
      const items = arr.length ? arr.map((v) => parseWhenToUi(v)) : [defaultExpr()];
      return { kind: "group", op, items, negate: false };
    }

    if (op === "exists") {
      const arr = Array.isArray(value) ? value : [];
      return {
        kind: "cond",
        op: "exists",
        left: operandToText(arr[0] ?? ""),
        right: "",
        negate: false,
      };
    }

    const arr = Array.isArray(value) ? value : [];
    const leafOp = (op === "neq" ? "ne" : op) as LeafOp;
    return {
      kind: "cond",
      op: leafOp,
      left: operandToText(arr[0] ?? ""),
      right: operandToText(arr[1] ?? ""),
      negate: false,
    };
  };

  const serializeUiToWhen = (expr: UiExpr): Record<string, unknown> => {
    const base = (() => {
      if (expr.kind === "group") {
        return { [expr.op]: expr.items.map((it) => serializeUiToWhen(it)) };
      }

      const left = parseOperandText(expr.left);
      if (expr.op === "exists") return { exists: [left] };
      const right = parseOperandText(expr.right);
      return { [expr.op]: [left, right] };
    })();

    return expr.negate ? { not: base } : base;
  };
  
  // Helpers to manage routes
  const routes = (node.data.nextNode?.routes as ConditionRoute[]) || [];
  const defaultRoute = node.data.nextNode?.default || "";

  const addRoute = () => {
      const newRoutes: ConditionRoute[] = [
          ...routes,
          { when: { eq: ["", ""] }, goto: "" }
      ];
      updateRoutes(newRoutes);
  };

  const removeRoute = (idx: number) => {
      const newRoutes = routes.filter((_, i) => i !== idx);
      updateRoutes(newRoutes);
  };

  const updateRoutes = (newRoutes: ConditionRoute[]) => {
      updateNodeData(node.id, {
          nextNode: {
              ...(node.data.nextNode || {}),
              routes: newRoutes
          }
      });
  };

  const updateRouteWhen = (idx: number, nextExpr: UiExpr) => {
    const newRoutes = [...routes];
    newRoutes[idx] = { ...newRoutes[idx], when: serializeUiToWhen(nextExpr) };
    updateRoutes(newRoutes);
  };

  const updateDefault = (val: string) => {
       updateNodeData(node.id, {
          nextNode: {
              ...(node.data.nextNode || {}),
              default: val
          }
      });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <NodeNameInput
          nodeId={node.id}
          name={String(node.data.name ?? "")}
          onNameChange={(val) => updateNodeData(node.id, { name: val })}
        />
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-200/50 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>Define conditions to route based on variable comparisons. Connect route handles on the canvas to set destinations.</span>
        </div>
      </div>

       {/* Routes Editor */}
       <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Conditional Routes
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Evaluated in order from top to bottom</p>
              </div>
              <button
                onClick={addRoute}
                className="text-xs bg-gradient-to-r from-pink-600 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-pink-700 hover:to-pink-600 transition-all shadow-sm hover:shadow-md font-medium flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Condition
              </button>
            </div>

            <div className="space-y-3">
                {routes.map((route, idx) => {
                     const expr = parseWhenToUi(route.when);
                     const setExpr = (next: UiExpr) => updateRouteWhen(idx, next);

                    return (
                        <div key={idx} className="p-4 bg-gradient-to-br from-white to-gray-50/50 border-2 border-gray-200 rounded-xl relative group transition-all hover:border-pink-300 hover:shadow-lg">
                             <button
                                onClick={() => removeRoute(idx)}
                                className="absolute top-3 right-3 text-gray-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 rounded-md"
                                title="Remove Condition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              </button>

                            {/* Condition Logic */}
                            <div className="mb-3 pr-8">
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2.5 block flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                                  </svg>
                                  Condition Logic
                                </label>
                                <ConditionExprEditor value={expr} onChange={setExpr} depth={0} />
                            </div>

                            {/* Target Display */}
                            <div className="pt-3 border-t border-gray-200/70">
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2 block flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  Then Go To
                                </label>
                                <TargetNodeDisplay
                                    nodeId={route.goto || ""}
                                    label=""
                                    title="Connect this route handle on the canvas to set destination"
                                />
                            </div>
                        </div>
                    );
                })}

                {routes.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-white">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/><path d="M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/><path d="M18 19a3 3 0 1 1-2.14-5.18"/>
                          </svg>
                        </div>
                        <div className="text-sm text-gray-600 font-semibold">No conditions defined yet</div>
                        <div className="text-xs text-gray-400 mt-1">Click "Add Condition" to create your first rule</div>
                    </div>
                )}
            </div>
       </div>

       {/* Default Route */}
       <div className="border-t-2 border-gray-100 pt-6">
            <div className="mb-3">
                <label className="text-sm font-bold text-gray-800 block flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Default Route (Else)
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Fallback when no conditions match</p>
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
