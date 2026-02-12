"use client";

type WsConnectionState = "disconnected" | "connecting" | "connected" | "error";

export type WsLogEntry = {
  id: string;
  direction: "incoming" | "outgoing" | "system";
  message: string;
  timestamp: string;
};

type WebSocketPanelProps = {
  url: string;
  protocolsText: string;
  draftMessage: string;
  latestResponse: string;
  isConnected: boolean;
  connectionState: WsConnectionState;
  messages: WsLogEntry[];
  onUrlChange: (value: string) => void;
  onProtocolsChange: (value: string) => void;
  onDraftMessageChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSend: () => void;
  onClearMessages: () => void;
};

const connectionBadgeStyles: Record<WsConnectionState, string> = {
  disconnected: "bg-gray-100 text-gray-700 border-gray-200",
  connecting: "bg-amber-100 text-amber-700 border-amber-200",
  connected: "bg-emerald-100 text-emerald-700 border-emerald-200",
  error: "bg-red-100 text-red-700 border-red-200",
};

export default function WebSocketPanel({
  url,
  protocolsText,
  draftMessage,
  latestResponse,
  isConnected,
  connectionState,
  messages,
  onUrlChange,
  onProtocolsChange,
  onDraftMessageChange,
  onConnect,
  onDisconnect,
  onSend,
  onClearMessages,
}: WebSocketPanelProps) {
  const formattedLatestResponse = (() => {
    const text = latestResponse.trim();
    if (!text) return "";
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return latestResponse;
    }
  })();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-600">WebSocket</div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${connectionBadgeStyles[connectionState]}`}
        >
          {connectionState}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">WebSocket URL</label>
          <input
            className="mt-2 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
            placeholder="wss://echo.websocket.org"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">
            Protocols (optional, comma-separated)
          </label>
          <input
            className="mt-2 w-full rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900"
            placeholder="json, chat.v1"
            value={protocolsText}
            onChange={(e) => onProtocolsChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isConnected ? (
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            onClick={onConnect}
          >
            Connect
          </button>
        )}
        <button
          type="button"
          className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          onClick={onClearMessages}
        >
          Clear Logs
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Message</label>
        <div className="mt-2 flex gap-2">
          <textarea
            className="min-h-[92px] flex-1 rounded-md border border-gray-200 p-2 bg-white shadow-sm text-sm text-gray-900 font-mono"
            placeholder='{"type":"ping"}'
            value={draftMessage}
            onChange={(e) => onDraftMessageChange(e.target.value)}
          />
          <button
            type="button"
            className={`h-fit rounded-md px-4 py-2 text-xs font-semibold text-white ${
              isConnected ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed"
            }`}
            onClick={onSend}
            disabled={!isConnected}
          >
            Send
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase text-gray-500">Latest Response</div>
          {formattedLatestResponse && (
            <button
              type="button"
              className="rounded bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-200"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(formattedLatestResponse);
                }
              }}
            >
              Copy
            </button>
          )}
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
          {formattedLatestResponse ? (
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-gray-700">
              {formattedLatestResponse}
            </pre>
          ) : (
            <div className="text-xs text-gray-400">No response yet.</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase text-gray-500">Message Log</div>
        <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 space-y-2">
          {messages.length === 0 ? (
            <div className="text-xs text-gray-400">No messages yet.</div>
          ) : (
            messages.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-md border p-2 text-xs ${
                  entry.direction === "incoming"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-900"
                    : entry.direction === "outgoing"
                      ? "border-indigo-100 bg-indigo-50 text-indigo-900"
                      : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase">
                  <span>{entry.direction}</span>
                  <span>{entry.timestamp}</span>
                </div>
                <pre className="font-mono whitespace-pre-wrap break-words">{entry.message}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
