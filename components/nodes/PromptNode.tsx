import { Handle, Position, NodeProps } from "reactflow";
import { useFlowStore } from "@/store/flow/flowStore";

type PromptRoute = {
  when?: { eq?: string[] };
  goto?: string;
  gotoId?: string;
  gotoFlow?: string;
  isGoBack?: boolean;
  isMainMenu?: boolean;
};

type PromptNextNode = {
  routes?: PromptRoute[];
  default?: string;
};

type PromptNodeData = {
  name?: string;
  message?: string;
  responseFormat?: "json" | "soap" | "ussd";
  responseBodyMapping?: Record<string, unknown>;
  responseBodyRaw?: string;
  responseStatusCode?: number;
  inputType?: "NON_ZERO_FLOAT" | "NON_ZERO_INT" | "FLOAT" | "INTEGER" | "STRING";
  invalidInputTypeMessage?: string;
  inputValidationEnabled?: boolean;
  nextNode?: PromptNextNode | string;
  persistByIndex?: boolean;
  persistSourceField?: string;
  persistFieldName?: string;
  validateIndexedList?: boolean;
  indexedListVar?: string;
  invalidInputMessage?: string;
  emptyInputMessage?: string;
  persistInput?: boolean;
  persistInputAs?: string;
  saveSessionStep?: boolean;
  sessionStepSessionId?: string;
  endCleanupSessionId?: string;
  responseType?: "CONTINUE" | "END";
  encryptInput?: boolean;
};

type PromptNodeProps = NodeProps<PromptNodeData>;

export default function PromptNode({ id, data, selected }: PromptNodeProps) {
  const edges = useFlowStore((s) => s.edges);
  const resolveTargetId = useFlowStore((s) => s.resolveTargetId);
  const isMenuMode =
    !!data.nextNode &&
    typeof data.nextNode === "object" &&
    Array.isArray((data.nextNode as PromptNextNode).routes);

  const toText = (value: unknown, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  };

  const previewText = (() => {
    if (data.responseFormat === "soap" || data.responseFormat === "ussd") {
      return String(data.responseBodyRaw ?? data.message ?? "").trim() || "No message";
    }
    if (
      data.responseBodyMapping &&
      typeof data.responseBodyMapping === "object" &&
      !Array.isArray(data.responseBodyMapping)
    ) {
      try {
        return JSON.stringify(data.responseBodyMapping, null, 2);
      } catch {
        return data.message || "No message";
      }
    }

    const rawMessage = String(data.message ?? "").trim();
    if ((rawMessage.startsWith("{") && rawMessage.endsWith("}")) || (rawMessage.startsWith("[") && rawMessage.endsWith("]"))) {
      return rawMessage;
    }

    return data.message || "No message";
  })();

  return (
    <div
      className={`group rounded-xl p-4 w-64 bg-white shadow-md border transition-all duration-200
      ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-300 scale-[1.02]"
          : "border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="font-bold text-indigo-600 truncate max-w-[180px]">
            {data.name || "Prompt"}
          </div>
          {typeof data.responseStatusCode === "number" && (
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              HTTP {data.responseStatusCode}
            </div>
          )}
          {data.responseFormat === "ussd" && (
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              USSD {data.responseType ?? "CONTINUE"}
            </div>
          )}
        </div>
        {data.encryptInput && (
          <div title="Encrypted Input Active" className="bg-amber-100 p-1 rounded text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      <div className="text-sm text-gray-700 break-all whitespace-pre-wrap transition-all duration-300 font-mono">
        {previewText}
      </div>

      {/* Menu Mode: Show Logic Rules (No Handles) */}
      {isMenuMode && (
        <div className="mt-3 pt-2 border-t border-gray-100 space-y-1.5">
          {/* Check if nextNode has routes (Logic Mode) */}
          {data.nextNode &&
            typeof data.nextNode === "object" &&
            data.nextNode.routes &&
            data.nextNode.routes.map((route: any, idx: number) => {
              // Extract input value from condition: { "eq": ["{{input}}", "1"] }
              const matchVal = toText(route.when?.eq?.[1], "?");
              const isGoBack = route.isGoBack || false;
              const isMainMenu = (route as any).toMainMenu || route.isMainMenu || false;
              const handleId = `route-${idx}`;
              const isActuallyConnected = edges.some(e => e.source === id && e.sourceHandle === handleId);

              // If it's a logic route (go back or main menu), we don't show the handle
              const showHandle = !isGoBack && !isMainMenu;

              let label =
                route.gotoFlow ||
                (route.gotoId || route.goto
                  ? resolveTargetId(String(route.gotoId || route.goto || "")).name
                  : "") ||
                "Target";
              if (isGoBack) label = "Go Back";
              if (isMainMenu) label = "Main Menu";
              if (!isGoBack && !isMainMenu && isActuallyConnected) {
                const target = edges.find(e => e.source === id && e.sourceHandle === handleId)?.target;
                if (target) {
                  const resolved = resolveTargetId(target);
                  label = resolved.name || label;
                }
              }

              return (
                <div
                  key={idx}
                  className={`relative flex items-center justify-between text-xs p-1.5 rounded border transition-colors ${
                    isActuallyConnected 
                      ? "bg-gray-50 border-gray-100" 
                      : (isGoBack || isMainMenu) 
                        ? "bg-indigo-50 border-indigo-100" 
                        : "bg-amber-50 border-amber-100"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={`font-mono bg-white px-1.5 py-0.5 border rounded font-bold shrink-0 ${
                      isActuallyConnected || isGoBack || isMainMenu ? "text-indigo-600" : "text-amber-600"
                    }`}>
                      {matchVal}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActuallyConnected ? "bg-emerald-500/60" : 
                      (isGoBack || isMainMenu) ? "bg-indigo-400" : 
                      "bg-amber-500/80 animate-pulse"
                    }`} />
                    <span
                      className={`font-medium truncate max-w-[80px] ${
                         isActuallyConnected || isGoBack || isMainMenu ? "text-gray-700" : "text-amber-700/80"
                      }`}
                      title={label}
                    >
                      {label}
                    </span>
                  </div>
                  
                  {/* Source Handle for this specific option */}
                  {showHandle && (
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={handleId}
                      className={`!-right-1.5 !w-2.5 !h-2.5 !border-2 ${
                        isActuallyConnected ? "!border-indigo-500 !bg-white" : "!border-amber-500 !bg-white"
                      }`}
                    />
                  )}
                </div>
              );
            })}

          {/* Fallback/Legacy: If no rules yet, show placeholder */}
          {(!data.nextNode ||
            typeof data.nextNode !== "object" ||
            !data.nextNode.routes ||
            data.nextNode.routes.length === 0) && (
            <div className="text-center text-[10px] text-gray-400 italic py-2">
              No routing rules defined
            </div>
          )}

          {/* Default Route Indicator */}
          <div className="pt-2 border-t border-gray-100 mb-2">
            <div className="flex items-center gap-1 text-[10px] text-gray-400 px-1">
              <span>Default:</span>
              <span className="font-medium text-gray-600 truncate max-w-[160px]">
                {(() => {
                  const fallbackId = data.nextNode && typeof data.nextNode === "object"
                    ? (data.nextNode as any).default
                    : (typeof data.nextNode === "string" ? data.nextNode : "");
                  if (!fallbackId) return "";
                  const resolved = resolveTargetId(fallbackId);
                  return resolved.name || fallbackId;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex justify-center relative">
        <Handle
          type="source"
          position={Position.Bottom}
          id="fallback"
          className={`!w-2.5 !h-2.5 !border-2 !static !translate-x-0 ${
            edges.some(e => e.source === id && (e.sourceHandle === 'fallback' || (!e.sourceHandle && !isMenuMode))) 
              ? "!border-indigo-500 !bg-white" 
              : "!border-gray-300 !bg-white"
          }`}
        />
      </div>

      <Handle type="target" position={Position.Top} />
    </div>
  );
}
