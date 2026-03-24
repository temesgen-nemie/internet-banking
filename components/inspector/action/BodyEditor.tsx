"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BodyEditorProps = {
  apiBodyText: string;
  apiBodyError: string | null;
  bodyMode: "json" | "soap" | "form";
  formFields: Array<{ id: string; key: string; value: string; description: string }>;
  onBodyModeChange: (value: "json" | "soap" | "form") => void;
  onApiBodyChange: (value: string) => void;
  onAddFormField: () => void;
  onRemoveFormField: (id: string) => void;
  onUpdateFormField: (id: string, field: "key" | "value" | "description", value: string) => void;
};

export default function BodyEditor({
  apiBodyText,
  apiBodyError,
  bodyMode,
  formFields,
  onBodyModeChange,
  onApiBodyChange,
  onAddFormField,
  onRemoveFormField,
  onUpdateFormField,
}: BodyEditorProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const bodyModeLabel =
    bodyMode === "soap" ? "SOAP XML" : bodyMode === "form" ? "x-www-form-urlencoded" : "JSON";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-gray-600">Body</label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase text-gray-500">
            Raw
          </span>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-40 items-center justify-between rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 shadow-sm hover:bg-gray-50 cursor-pointer whitespace-nowrap"
              >
                <span className="truncate">{bodyModeLabel}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 shrink-0 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40 z-100001 bg-white text-gray-900 border border-gray-200 shadow-md"
            >
              <DropdownMenuItem
                className="cursor-pointer focus:bg-gray-100 focus:text-gray-900"
                onClick={() => {
                  onBodyModeChange("json");
                  setMenuOpen(false);
                }}
              >
                JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-gray-100 focus:text-gray-900"
                onClick={() => {
                  onBodyModeChange("soap");
                  setMenuOpen(false);
                }}
              >
                SOAP XML
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-gray-100 focus:text-gray-900"
                onClick={() => {
                  onBodyModeChange("form");
                  setMenuOpen(false);
                }}
              >
                x-www-form-urlencoded
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {bodyMode === "form" ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase text-gray-500">
            <div>Key</div>
            <div>Value</div>
            <div>Description</div>
            <div />
          </div>
          <div className="space-y-2 p-3">
            {formFields.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-400">
                No form fields yet.
              </div>
            ) : (
              formFields.map((field) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <input
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
                    placeholder="key"
                    value={field.key}
                    onChange={(e) => onUpdateFormField(field.id, "key", e.target.value)}
                  />
                  <input
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
                    placeholder="value"
                    value={field.value}
                    onChange={(e) => onUpdateFormField(field.id, "value", e.target.value)}
                  />
                  <input
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm"
                    placeholder="description"
                    value={field.description}
                    onChange={(e) => onUpdateFormField(field.id, "description", e.target.value)}
                  />
                  <button
                    type="button"
                    className="px-2 text-xs text-gray-400 hover:text-red-500"
                    onClick={() => onRemoveFormField(field.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
            <button
              type="button"
              className="rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 cursor-pointer"
              onClick={onAddFormField}
            >
              + Add Row
            </button>
          </div>
        </div>
      ) : (
        <textarea
          className="mt-2 w-full rounded-md border border-gray-100 p-2 bg-white shadow-sm font-mono text-sm placeholder-gray-400 text-gray-900"
          value={apiBodyText}
          rows={8}
          onChange={(e) => onApiBodyChange(e.target.value)}
        />
      )}
      {apiBodyError && (
        <div className="text-xs text-red-500 mt-1">{apiBodyError}</div>
      )}
    </div>
  );
}
