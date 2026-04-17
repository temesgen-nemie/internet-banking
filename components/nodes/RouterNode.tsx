import { Handle, NodeProps, Position } from "reactflow";
import { useFlowStore } from "@/store/flow/flowStore";

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
  defaultFlow?: string;
};

type RouterNodeData = {
  name?: string;
  url?: string;
  method?: string;
  sessionMode?: "required" | "optional" | "disabled";
  responseMapping?: Record<string, string>;
  persistResponseMappingKeys?: string[];
  inputManagerSaveSessionId?: string;
  nextNode?: string | RouterNextNode;
};

type RouterNodeProps = NodeProps<RouterNodeData>;

export default function RouterNode({ id, data, selected }: RouterNodeProps) {
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  const resolveTargetId = useFlowStore((s) => s.resolveTargetId);

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

  const nextNode =
    typeof data.nextNode === "string"
      ? { routes: [], default: data.nextNode, defaultId: data.nextNode }
      : data.nextNode;
  const routes = nextNode?.routes || [];

  return (
    <div
      className={`group rounded-xl p-0 w-64 bg-white shadow-xl border-2 transition-all duration-200 overflow-hidden ${
        selected
          ? "border-amber-500 ring-4 ring-amber-100 scale-[1.02]"
          : "border-gray-100 hover:border-amber-200"
      }`}
    >
      <div className="bg-gradient-to-tr from-amber-500 to-orange-500 p-3 flex items-center justify-between">
        <div className="font-bold text-white truncate max-w-[180px] flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-white/90"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3v12" />
            <path d="M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6" />
            <path d="M18 3a3 3 0 1 1-2.2 5" />
            <path d="M18 13a3 3 0 1 0 2.2 5" />
            <path d="M8.5 8.5 15.5 5.5" />
            <path d="M8.5 16.5 15.5 19.5" />
          </svg>
          {data.name || "Router"}
        </div>
      </div>

      <div className="p-3 bg-white space-y-2">
        <div className="text-[10px] text-gray-500 font-mono truncate rounded bg-amber-50 px-2 py-1 border border-amber-100">
          <span className="font-bold text-amber-700">{data.method || "POST"}</span>{" "}
          {data.url || "/api/menu/nav"}
        </div>

        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide rounded bg-gray-50 px-2 py-1 border border-gray-100">
          Session: <span className="font-bold text-gray-700">{data.sessionMode || "required"}</span>
        </div>

        {routes.map((route, idx) => {
          const handleId = `route-${idx}`;
          const isGoBack = Boolean(route.isGoBack);
          const isMainMenu = Boolean(route.toMainMenu);
          const isConnected = edges.some(
            (e) => e.source === id && e.sourceHandle === handleId
          );

          let label = "Set Target";
          if (isMainMenu) label = "Main Menu";
          else if (isGoBack) label = "Go Back";
          else if (route.goto) {
            const resolved = resolveTargetId(route.goto);
            label = resolved.name || route.goto;
          }

          const input = toText(route.when?.eq?.[1], "");

          return (
            <div
              key={idx}
              className={`relative flex items-center justify-between text-xs p-2 rounded-lg border transition-colors group/item ${
                isConnected || isGoBack || isMainMenu
                  ? "bg-amber-50 border-amber-100"
                  : "bg-gray-50 border-gray-100"
              }`}
            >
              <div className="flex flex-col gap-0.5 overflow-hidden w-full pr-4">
                <div className="text-[10px] text-gray-500 font-mono truncate">
                  input == <span className="font-bold text-amber-700">{input || "?"}</span>
                </div>
                <span
                  className={`font-semibold truncate ${
                    isConnected || isGoBack || isMainMenu
                      ? "text-gray-800"
                      : "text-gray-500"
                  }`}
                  title={label}
                >
                  {label}
                </span>
                {isGoBack && route.goBackToFlow ? (
                  <span className="text-[10px] text-gray-500 truncate">
                    Flow: {route.goBackToFlow}
                  </span>
                ) : null}
              </div>

              {!isGoBack && !isMainMenu ? (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={handleId}
                  className={`!-right-3 !w-3 !h-3 !border-2 transition-all ${
                    isConnected
                      ? "!border-amber-500 !bg-white"
                      : "!border-gray-300 !bg-gray-50 group-hover/item:!border-amber-300"
                  }`}
                />
              ) : null}
            </div>
          );
        })}

        <div
          className={`relative flex items-center justify-between text-xs p-2 rounded-lg border transition-colors group/item ${
            edges.some((e) => e.source === id && e.sourceHandle === "default")
              ? "bg-gray-100 border-gray-200"
              : "bg-white border-dashed border-gray-200"
          }`}
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Default
          </span>
          <span className="text-gray-600 font-medium truncate max-w-[100px] ml-auto mr-2">
            {(() => {
              const flowTarget = nextNode?.defaultFlow;
              if (flowTarget) {
                const leafName = flowTarget.split("/").pop();
                return leafName || flowTarget;
              }

              const fallback = nextNode?.defaultId || nextNode?.default;
              if (!fallback) return "Stay";
              const resolved = resolveTargetId(fallback);
              const targetNode = nodes.find((n) => n.id === fallback);
              if (!resolved.name && targetNode?.type === "group") return "Stay";
              return resolved.name || fallback;
            })()}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className={`!-right-3 !w-3 !h-3 !border-2 transition-all ${
              edges.some((e) => e.source === id && e.sourceHandle === "default")
                ? "!border-gray-500 !bg-white"
                : "!border-gray-300 !bg-gray-50 group-hover/item:!border-gray-400"
            }`}
          />
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-amber-500"
      />
    </div>
  );
}
