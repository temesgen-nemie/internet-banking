"use client";
import { useState } from "react";

type ResponseMappingEditorProps = {
  mappings: Array<{ id: string; key: string; value: string; persist?: boolean; encrypt?: boolean }>;
  options: string[];
  persistManager: "inputManager" | "commonManager";
  commonManagerSaveMode: "flowSession" | "provided" | "generate";
  commonManagerSaveSessionId: string;
  commonManagerSessionOutputVar: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, key: string, value: string, persist: boolean, encrypt: boolean) => void;
  onPersistManagerChange: (value: "inputManager" | "commonManager") => void;
  onCommonManagerSaveModeChange: (value: "flowSession" | "provided" | "generate") => void;
  onCommonManagerSaveSessionIdChange: (value: string) => void;
  onCommonManagerSessionOutputVarChange: (value: string) => void;
};

export default function ResponseMappingEditor({
  mappings,
  options,
  persistManager,
  commonManagerSaveMode,
  commonManagerSaveSessionId,
  commonManagerSessionOutputVar,
  onAdd,
  onRemove,
  onUpdate,
  onPersistManagerChange,
  onCommonManagerSaveModeChange,
  onCommonManagerSaveSessionIdChange,
  onCommonManagerSessionOutputVarChange,
}: ResponseMappingEditorProps) {
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">
          Response Mapping
        </label>
        <button
          className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100"
          onClick={onAdd}
        >
          + Add Mapping
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Persist Manager
          </label>
          <select
            className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
            value={persistManager}
            onChange={(e) =>
              onPersistManagerChange(e.target.value as "inputManager" | "commonManager")
            }
          >
            <option value="inputManager">inputManager</option>
            <option value="commonManager">commonManager</option>
          </select>
        </div>
        {persistManager === "commonManager" && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Session Mode
            </label>
            <select
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
              value={commonManagerSaveMode}
              onChange={(e) =>
                onCommonManagerSaveModeChange(
                  e.target.value as "flowSession" | "provided" | "generate"
                )
              }
            >
              <option value="flowSession">Use flow session</option>
              <option value="provided">Use provided session</option>
              <option value="generate">Generate session</option>
            </select>
          </div>
        )}
        {persistManager === "commonManager" && commonManagerSaveMode === "provided" && (
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Session Id
            </label>
            <input
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
              placeholder="{{vars.sessionId}}"
              value={commonManagerSaveSessionId}
              onChange={(e) => onCommonManagerSaveSessionIdChange(e.target.value)}
            />
          </div>
        )}
        {persistManager === "commonManager" && (
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Session Output Var
            </label>
            <input
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
              placeholder="commonSessionId"
              value={commonManagerSessionOutputVar}
              onChange={(e) => onCommonManagerSessionOutputVarChange(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {mappings.length === 0 && (
          <div className="text-xs text-gray-400">
            No mappings added yet.
          </div>
        )}
        {mappings.map((mapping) => {
          const optionValues = options.map(
            (path) => `{{response.${path}}}`
          );
          const hasValue =
            mapping.value !== "" && optionValues.includes(mapping.value);

          return (
            <div
              key={mapping.id}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center"
            >
              <input
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
                placeholder="Field name"
                value={mapping.key}
                onChange={(e) =>
                  onUpdate(mapping.id, e.target.value, mapping.value, !!mapping.persist, !!mapping.encrypt)
                }
              />
              {editModes[mapping.id] ? (
                <div className="relative flex items-center">
                  <input
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm pr-8"
                    placeholder="Type value (e.g. {{var}})"
                    value={mapping.value}
                    onChange={(e) =>
                      onUpdate(
                        mapping.id,
                        mapping.key,
                        e.target.value,
                        !!mapping.persist,
                        !!mapping.encrypt
                      )
                    }
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const newModes = { ...editModes };
                      delete newModes[mapping.id];
                      setEditModes(newModes);
                    }}
                    className="absolute right-1.5 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="Switch to list selection"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ) : (
                <select
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm w-full"
                  value={mapping.value}
                  onChange={(e) => {
                    if (e.target.value === "__custom_mode__") {
                      setEditModes({ ...editModes, [mapping.id]: true });
                    } else {
                      onUpdate(
                        mapping.id,
                        mapping.key,
                        e.target.value,
                        !!mapping.persist,
                        !!mapping.encrypt
                      );
                    }
                  }}
                >
                  <option value="">Select response field</option>
                  <option value="__custom_mode__" className="font-medium text-indigo-600 bg-indigo-50">
                    + Type manually...
                  </option>
                  {options.map((path, index) => {
                    const value = `{{response.${path}}}`;
                    return (
                      <option key={`${value}-${index}`} value={value}>
                        {path}
                      </option>
                    );
                  })}
                  {!hasValue && mapping.value && (
                    <option value={mapping.value}>Custom: {mapping.value}</option>
                  )}
                </select>
              )}
              <div className="flex items-center gap-1.5 px-1" title="Persist this mapping to local storage">
                <input
                  type="checkbox"
                  checked={!!mapping.persist}
                  onChange={(e) =>
                    onUpdate(mapping.id, mapping.key, mapping.value, e.target.checked, !!mapping.encrypt)
                  }
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-gray-400 font-medium uppercase">Persist</span>
              </div>
              <div className="flex items-center gap-1.5 px-1" title="Encrypt this mapping in local storage">
                <input
                  type="checkbox"
                  checked={!!mapping.encrypt}
                  onChange={(e) =>
                    onUpdate(mapping.id, mapping.key, mapping.value, !!mapping.persist, e.target.checked)
                  }
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-gray-400 font-medium uppercase">Encrypt</span>
              </div>
              <button
                className="text-xs text-gray-400 hover:text-red-500 px-2"
                onClick={() => onRemove(mapping.id)}
                title="Remove mapping"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
