"use client";

type ResponseViewerProps = {
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error: string | null;
};

export default function ResponseViewer({
  status,
  statusText,
  headers,
  body,
  error,
}: ResponseViewerProps) {
  const hasResponse =
    status !== null || body.trim().length > 0 || Object.keys(headers).length > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">
        Response
      </div>
      <div className="p-3">
        {!hasResponse && !error ? (
          <div className="text-xs text-gray-400">
            No response yet. Click Send to populate this area.
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            )}
            {status !== null && (
              <div className="text-xs text-gray-600">
                <span className="font-semibold">Status:</span>{" "}
                {status} {statusText}
              </div>
            )}
            {Object.keys(headers).length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Headers
                </div>
                <div className="rounded border border-gray-200 bg-white p-2 divide-y divide-gray-50">
                  {Object.entries(headers).map(([key, value]) => (
                    <div key={key} className="text-xs text-gray-700 py-1 first:pt-0 last:pb-0 break-all">
                      <span className="font-semibold">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {body.trim().length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Body
                </div>
                <pre className="max-h-72 overflow-y-auto overflow-x-auto rounded border border-gray-100 bg-white p-2 text-xs text-gray-700 whitespace-pre-wrap break-words">
                  {(() => {
                    try {
                      const parsed = JSON.parse(body);
                      return JSON.stringify(parsed, null, 2);
                    } catch {
                      return body;
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
