"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getLogs, searchLogs } from "@/lib/api";
import LogsAccordion, { type LogEntry } from "@/components/logs/LogsAccordion";
import LogsFilters from "@/components/logs/LogsFilters";

const toIsoRange = (value: Date | null, isEnd: boolean) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
};

const defaultRange = () => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 3);
  return { from, to: now };
};

export default function LogsTable() {
  const initialRange = useMemo(() => defaultRange(), []);
  const [fromDate, setFromDate] = useState<Date | null>(initialRange.from);
  const [toDate, setToDate] = useState<Date | null>(initialRange.to);
  const [limit, setLimit] = useState(100);
  const [query, setQuery] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    const trimmedQuery = query.trim();
    const trimmedSession = sessionId.trim();
    const trimmedStatus = status.trim();
    const hasSearch =
      Boolean(trimmedQuery) ||
      Boolean(trimmedSession) ||
      Boolean(trimmedStatus);

    const from = fromDate ? toIsoRange(fromDate, false) : "";
    const to = toDate ? toIsoRange(toDate, true) : "";
    if ((fromDate && !from) || (toDate && !to)) {
      setError("Please select a valid date range.");
      return;
    }

    if (!hasSearch && (!from || !to)) {
      setError("Please select a valid date range.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = hasSearch
        ? await searchLogs({
            q: trimmedQuery || undefined,
            from: from || undefined,
            to: to || undefined,
            session_id: trimmedSession || undefined,
            status: trimmedStatus || undefined,
            limit,
            offset: 0,
          })
        : await getLogs({ from, to, limit });
      const entries = Array.isArray(data?.data) ? data.data : [];
      setLogs(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs.");
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, limit, query, sessionId, status, toDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchLogs();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [fetchLogs]);

  return (
    <div className="flex min-h-full flex-col gap-4 md:h-full">
      <LogsFilters
        fromDate={fromDate}
        toDate={toDate}
        limit={limit}
        query={query}
        sessionId={sessionId}
        status={status}
        isLoading={isLoading}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onLimitChange={setLimit}
        onQueryChange={setQuery}
        onSessionIdChange={setSessionId}
        onStatusChange={setStatus}
        onRefresh={fetchLogs}
      />
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="min-h-[240px] overflow-visible md:flex-1 md:min-h-0 md:overflow-auto">
        {isLoading && logs.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
            Loading logs...
          </div>
        ) : (
          <LogsAccordion logs={logs} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}
