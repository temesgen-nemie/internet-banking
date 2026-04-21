"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import LogsAccordion, { type LogEntry } from "@/components/logs/LogsAccordion";
import LogsTable from "@/components/logs/LogsTable";
import RedisInspector from "@/components/logs/RedisInspector";

type LogsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TabKey = "fetch" | "live" | "redis";
type LogSourceKey = "builder" | "backend";

type LogsModalContentProps = {
  onOpenChange: (open: boolean) => void;
};

const getInitialSize = () => {
  if (typeof window === "undefined") {
    return { width: 1100, height: 760 };
  }
  const width = Math.min(window.innerWidth * 0.9, 1100);
  const height = Math.min(window.innerHeight * 0.85, 760);
  return { width, height };
};

const resolveLogsWebSocketUrl = () => {

  // const configured = process.env.NEXT_PUBLIC_LOGS_WS_URL?.trim();

  const configured="wss://sau.eaglelionsystems.com/ussdpush/builder/api/v1/admin/logs/stream"

  
  if (configured) {
    return configured;
  }
  if (typeof window === "undefined") {
    return "ws://localhost:5000/v1/ussdpush/api/admin/logs/stream";
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${wsProtocol}://localhost:5000/v1/ussdpush/api/admin/logs/stream`;
};

const resolveBackendLogsWebSocketUrl = () => {
  const configured = process.env.NEXT_PUBLIC_BACKEND_LOGS_WS_URL?.trim();
  if (configured) {
    return configured;
  }
  return "wss://sau.eaglelionsystems.com/v1.0/superappussd/dashen_push_otp_payment_middleware/logs/live";
};

const resolveBackendLogsFetchUrl = () => {
  const configured = process.env.NEXT_PUBLIC_BACKEND_LOGS_FETCH_URL?.trim();
  if (configured) {
    return configured;
  }
  return "https://sau.eaglelionsystems.com/v1.0/superappussd/dashen_push_otp_payment_middleware/logs/fetch";
};

function LogsModalContent({ onOpenChange }: LogsModalContentProps) {
  const [activeSource, setActiveSource] = useState<LogSourceKey>("builder");
  const [activeTab, setActiveTab] = useState<TabKey>("fetch");
  const [builderLiveLogs, setBuilderLiveLogs] = useState<LogEntry[]>([]);
  const [builderLiveRaw, setBuilderLiveRaw] = useState<string[]>([]);
  const [isBuilderLiveConnected, setIsBuilderLiveConnected] = useState(false);
  const [backendLiveLogs, setBackendLiveLogs] = useState<LogEntry[]>([]);
  const [backendLiveRaw, setBackendLiveRaw] = useState<string[]>([]);
  const [isBackendLiveConnected, setIsBackendLiveConnected] = useState(false);
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(getInitialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const modalRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsMobile(window.innerWidth < 768);
    };

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    const attachSocket = (
      url: string,
      setConnected: (value: boolean) => void,
      setRaw: React.Dispatch<React.SetStateAction<string[]>>,
      setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>
    ) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => setConnected(true));
      socket.addEventListener("close", () => setConnected(false));
      socket.addEventListener("error", () => setConnected(false));
      socket.addEventListener("message", (event) => {
        setRaw((prev) => {
          const next = [event.data, ...prev];
          return next.slice(0, 500);
        });
        try {
          const parsed = JSON.parse(event.data) as LogEntry;
          setLogs((prev) => {
            const next = [parsed, ...prev];
            return next.slice(0, 500);
          });
        } catch {
          // Ignore malformed messages.
        }
      });
      return socket;
    };

    const builderSocket = attachSocket(
      resolveLogsWebSocketUrl(),
      setIsBuilderLiveConnected,
      setBuilderLiveRaw,
      setBuilderLiveLogs
    );
    const backendSocket = attachSocket(
      resolveBackendLogsWebSocketUrl(),
      setIsBackendLiveConnected,
      setBackendLiveRaw,
      setBackendLiveLogs
    );

    return () => {
      builderSocket.close();
      backendSocket.close();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        setOffset({
          x: event.clientX - dragStart.x,
          y: event.clientY - dragStart.y,
        });
      } else if (isResizing) {
        const deltaX = event.clientX - resizeStart.x;
        const deltaY = event.clientY - resizeStart.y;
        setSize({
          width: Math.max(720, resizeStart.width + deltaX),
          height: Math.max(420, resizeStart.height + deltaY),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if ((isDragging || isResizing) && !isMobile) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragStart, isDragging, isMobile, isResizing, resizeStart]);

  useEffect(() => {
    if (activeTab !== "live" || !isTerminalMode) return;
    const node = terminalRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [activeTab, isTerminalMode, activeSource, builderLiveRaw, backendLiveRaw]);

  const liveLogs = activeSource === "builder" ? builderLiveLogs : backendLiveLogs;
  const liveRaw = activeSource === "builder" ? builderLiveRaw : backendLiveRaw;
  const isLiveConnected =
    activeSource === "builder" ? isBuilderLiveConnected : isBackendLiveConnected;
  const backendFetchUrl = resolveBackendLogsFetchUrl();

  const parseNestedJson = (value: unknown, depth = 0): unknown => {
    if (depth > 4) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          return parseNestedJson(parsed, depth + 1);
        } catch {
          return value;
        }
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => parseNestedJson(item, depth + 1));
    }
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).reduce(
        (acc, [key, val]) => {
          acc[key] = parseNestedJson(val, depth + 1);
          return acc;
        },
        {} as Record<string, unknown>
      );
    }
    return value;
  };

  const formatTerminalLine = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      const normalized = parseNestedJson(parsed);
      return JSON.stringify(normalized, null, 2);
    } catch {
      return value;
    }
  };

  const modalStyle: CSSProperties = isMobile
    ? {
        position: "fixed",
        left: "8px",
        top: "8px",
        width: "calc(100vw - 16px)",
        height: "calc(100dvh - 16px)",
        maxHeight: "calc(100dvh - 16px)",
        maxWidth: "calc(100vw - 16px)",
        transform: "none",
      }
    : {
        position: "fixed",
        left: `calc(50% + ${offset.x}px + clamp(80px, 12vw, 300px))`,
        top: `calc(50% + ${offset.y}px + clamp(450px, 18vh, 450px))`,
        transform: "translate(-50%, -50%)",
        width: size.width > 0 ? size.width : undefined,
        height: size.height > 0 ? size.height : undefined,
        maxHeight: "90vh",
        maxWidth: "95vw",
      };

  return (
    <div className="fixed inset-0 z-100000 pointer-events-none">
      <div
        ref={modalRef}
        style={modalStyle}
        className="rounded-xl bg-card text-card-foreground shadow-2xl ring-1 ring-black/5 flex h-full min-h-0 flex-col overflow-hidden pointer-events-auto transition-none"
      >
        <div
          onMouseDown={(event) => {
            if (isMobile) return;
            if ((event.target as HTMLElement).closest("button")) return;
            setDragStart({
              x: event.clientX - offset.x,
              y: event.clientY - offset.y,
            });
            setIsDragging(true);
          }}
          className={`relative shrink-0 border-b border-border bg-card/95 px-4 py-4 md:px-6 ${
            isMobile
              ? "flex flex-col gap-4"
              : "flex items-start justify-between gap-4 cursor-grab active:cursor-grabbing"
          }`}
        >
          <div className={`min-w-0 ${isMobile ? "flex items-start justify-between gap-3" : ""}`}>
            <div className="min-w-0">
              <div className="text-lg font-bold text-foreground">USSD Logs</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSource("builder")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activeSource === "builder"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Builder Logs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSource("backend");
                    if (activeTab === "redis") {
                      setActiveTab("fetch");
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activeSource === "backend"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Backend Logs
                </button>
              </div>
              {activeTab === "live" ? (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isLiveConnected
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                    }`}
                  >
                    {isLiveConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              ) : null}
            </div>

            {isMobile ? (
              <div className="flex items-center gap-2">
                {activeTab === "live" ? (
                  <button
                    type="button"
                    onClick={() => setIsTerminalMode((prev) => !prev)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      isTerminalMode
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Terminal Mode
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Close logs"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : null}
          </div>
          <div
            className={`flex flex-wrap items-center gap-2 ${
              isMobile
                ? ""
                : "pointer-events-none absolute left-1/2 top-4 -translate-x-1/2"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("fetch")}
              className={`pointer-events-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "fetch"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Fetch Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("live")}
              className={`pointer-events-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "live"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Live Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("redis")}
              disabled={activeSource !== "builder"}
              className={`pointer-events-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "redis"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              } ${activeSource !== "builder" ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Redis
            </button>
          </div>
          <div className={`flex gap-2 ${isMobile ? "hidden" : "flex-col items-end"}`}>
            <div className="flex items-center gap-2">
              {activeTab === "live" ? (
                <button
                  type="button"
                  onClick={() => setIsTerminalMode((prev) => !prev)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    isTerminalMode
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Terminal Mode
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Close logs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:overflow-hidden md:p-6">
          {activeTab === "fetch" ? (
            <LogsTable
              source={activeSource}
              fetchUrl={activeSource === "backend" ? backendFetchUrl : undefined}
            />
          ) : activeTab === "live" ? (
            <div className="h-full overflow-auto">
              {isTerminalMode ? (
                <div className="rounded-2xl border border-border bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-900/70 dark:text-slate-100">
                  <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Live Stream
                  </div>
                  <div
                    ref={terminalRef}
                    className="max-h-[65vh] overflow-auto px-3 py-3 font-mono text-[11px] leading-5 text-slate-900 md:px-4 dark:text-slate-100"
                  >
                    {liveRaw.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">
                        Waiting for logs...
                      </div>
                    ) : (
                      liveRaw
                        .slice()
                        .reverse()
                        .map((line, index) => (
                          <pre
                            key={`${index}-${line.slice(0, 24)}`}
                            className="mb-3 whitespace-pre-wrap wrap-break-word rounded-lg border border-border/60 bg-white/80 p-3 shadow-sm last:mb-0 dark:bg-slate-900/60"
                          >
                            {formatTerminalLine(line)}
                          </pre>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                <LogsAccordion logs={liveLogs} isLoading={!isLiveConnected} />
              )}
            </div>
          ) : (
            <RedisInspector />
          )}
        </div>

        {!isMobile ? (
          <div
            onMouseDown={(event) => {
              event.stopPropagation();
              setResizeStart({
                x: event.clientX,
                y: event.clientY,
                width: modalRef.current?.offsetWidth || size.width,
                height: modalRef.current?.offsetHeight || size.height,
              });
              setIsResizing(true);
            }}
            className="absolute bottom-2 right-2 h-4 w-4 cursor-nwse-resize"
          >
            <div className="h-full w-full border-b-2 border-r-2 border-muted-foreground/40" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LogsModal({ open, onOpenChange }: LogsModalProps) {
  if (!open) return null;
  return <LogsModalContent onOpenChange={onOpenChange} />;
}
