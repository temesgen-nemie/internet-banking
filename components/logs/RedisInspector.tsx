"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getRedisEntries,
  getRedisIndexes,
  type RedisEntry,
  type RedisIndexInfo,
} from "@/lib/api";

type RedisState = {
  entries: RedisEntry[];
  cursor: string;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  pattern: string;
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
};

export default function RedisInspector() {
  const [indexes, setIndexes] = useState<RedisIndexInfo[]>([]);
  const [activeDb, setActiveDb] = useState<number | null>(null);
  const [states, setStates] = useState<Record<number, RedisState>>({});
  const [loadingIndexes, setLoadingIndexes] = useState(false);
  const [indexesError, setIndexesError] = useState<string | null>(null);

  const loadIndexes = useCallback(async () => {
    setLoadingIndexes(true);
    setIndexesError(null);
    try {
      const response = await getRedisIndexes();
      const nextIndexes = Array.isArray(response.data) ? response.data : [];
      setIndexes(nextIndexes);
      setActiveDb((current) =>
        current !== null && nextIndexes.some((entry) => entry.db === current)
          ? current
          : (nextIndexes[0]?.db ?? null)
      );
      setStates((current) => {
        const next = { ...current };
        for (const index of nextIndexes) {
          next[index.db] = next[index.db] ?? {
            entries: [],
            cursor: "0",
            hasMore: false,
            loading: false,
            error: null,
            pattern: "*",
          };
        }
        return next;
      });
    } catch (error) {
      setIndexesError(error instanceof Error ? error.message : "Failed to load redis indexes.");
    } finally {
      setLoadingIndexes(false);
    }
  }, []);

  useEffect(() => {
    void loadIndexes();
  }, [loadIndexes]);

  const loadEntries = useCallback(async (db: number, append = false) => {
    setStates((current) => ({
      ...current,
      [db]: {
        ...(current[db] ?? {
          entries: [],
          cursor: "0",
          hasMore: false,
          loading: false,
          error: null,
          pattern: "*",
        }),
        loading: true,
        error: null,
      },
    }));

    try {
      const state = states[db] ?? {
        entries: [],
        cursor: "0",
        hasMore: false,
        loading: false,
        error: null,
        pattern: "*",
      };
      const response = await getRedisEntries({
        db,
        cursor: append ? state.cursor : "0",
        pattern: state.pattern || "*",
        limit: 50,
      });
      const payload = response.data;
      setStates((current) => {
        const existing = current[db] ?? state;
        return {
          ...current,
          [db]: {
            ...existing,
            entries: append ? [...existing.entries, ...payload.entries] : payload.entries,
            cursor: payload.cursor,
            hasMore: payload.hasMore,
            loading: false,
            error: null,
            pattern: payload.pattern,
          },
        };
      });
    } catch (error) {
      setStates((current) => ({
        ...current,
        [db]: {
          ...(current[db] ?? {
            entries: [],
            cursor: "0",
            hasMore: false,
            loading: false,
            error: null,
            pattern: "*",
          }),
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load redis entries.",
        },
      }));
    }
  }, [states]);

  useEffect(() => {
    if (activeDb === null) return;
    const state = states[activeDb];
    if (!state || (state.entries.length === 0 && !state.loading && !state.error)) {
      void loadEntries(activeDb, false);
    }
  }, [activeDb, loadEntries, states]);

  const activeState = activeDb !== null ? states[activeDb] : undefined;
  const activeIndex = useMemo(
    () => indexes.find((entry) => entry.db === activeDb) ?? null,
    [activeDb, indexes]
  );

  return (
    <div className="h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Redis Viewer</div>
          <div className="text-xs text-muted-foreground">
            Browse configured Redis DB indexes and inspect saved values.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadIndexes()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Refresh Indexes
        </button>
      </div>

      <div className="grid h-[calc(100%-72px)] grid-cols-[220px_1fr] overflow-hidden">
        <div className="border-r border-border bg-muted/20 p-3">
          {loadingIndexes ? (
            <div className="text-xs text-muted-foreground">Loading indexes...</div>
          ) : indexesError ? (
            <div className="text-xs text-red-500">{indexesError}</div>
          ) : (
            <div className="space-y-2">
              {indexes.map((index) => (
                <button
                  key={index.db}
                  type="button"
                  onClick={() => setActiveDb(index.db)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    activeDb === index.db
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-border bg-background text-foreground hover:border-indigo-200 hover:bg-background/80"
                  }`}
                >
                  <div className="text-sm font-semibold">{index.name}</div>
                  <div className="text-[11px] text-muted-foreground">DB {index.db}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex h-full flex-col overflow-hidden p-4">
          {activeIndex && activeState ? (
            <>
              <div className="mb-4 flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Match Pattern
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm"
                    value={activeState.pattern}
                    onChange={(event) => {
                      const value = event.target.value;
                      setStates((current) => ({
                        ...current,
                        [activeIndex.db]: {
                          ...(current[activeIndex.db] ?? activeState),
                          pattern: value,
                        },
                      }));
                    }}
                    placeholder="*"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadEntries(activeIndex.db, false)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Refresh DB {activeIndex.db}
                </button>
              </div>

              {activeState.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {activeState.error}
                </div>
              ) : null}

              <div className="flex-1 overflow-auto rounded-xl border border-border bg-background">
                {activeState.loading && activeState.entries.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading entries...</div>
                ) : activeState.entries.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No entries found for this index.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {activeState.entries.map((entry) => (
                      <div key={`${entry.key}-${entry.type}`} className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">
                            {entry.key}
                          </code>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            {entry.type}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            TTL {entry.ttl < 0 ? "none" : entry.ttl}
                          </span>
                        </div>
                        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-900">
                          {formatValue(entry.value)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeState.hasMore ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void loadEntries(activeIndex.db, true)}
                    disabled={activeState.loading}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
                  >
                    {activeState.loading ? "Loading..." : "Load More"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Select a Redis index to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
}
