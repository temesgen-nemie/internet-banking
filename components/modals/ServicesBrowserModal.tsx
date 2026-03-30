"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createService,
  deleteService,
  fetchServices,
  type CreateServicePayload,
  type ServiceEntry,
  type ServiceStructureNode,
} from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ServicesBrowserModalProps = {
  open: boolean;
  onClose: () => void;
};

const TreeItem = ({
  node,
  depth,
  query,
}: {
  node: ServiceStructureNode;
  depth: number;
  query: string;
}) => {
  const isDir = node.type === "directory";
  const needle = query.trim().toLowerCase();
  const matches =
    !needle || node.name.toLowerCase().includes(needle) || node.path.toLowerCase().includes(needle);
  const hasMatchingChild = isDir
    ? (node.children || []).some((child) =>
        (child.name + child.path).toLowerCase().includes(needle)
      )
    : false;
  if (!matches && !hasMatchingChild) return null;
  return (
    <div className="space-y-1">
      <div
        className={`group flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-all ${
          isDir ? "font-semibold text-gray-800" : "text-gray-600"
        } ${matches ? "bg-white/80 shadow-[0_1px_0_rgba(0,0,0,0.02)]" : "opacity-70"}`}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isDir ? "bg-indigo-500" : "bg-slate-300"
          }`}
        />
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-[10px] text-gray-400">{node.type}</span>
      </div>
      {isDir && node.children?.length ? (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} query={query} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default function ServicesBrowserModal({ open, onClose }: ServicesBrowserModalProps) {
  const [depth, setDepth] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [serviceNameInput, setServiceNameInput] = useState("");
  const [createForm, setCreateForm] = useState<CreateServicePayload>({
    projectPath: "",
    projectNameAndRootFormat: "as-provided",
    framework: "express",
    bundler: "esbuild",
    unitTestRunner: "none",
    e2eTestRunner: "none",
    linter: "eslint",
    dryRun: false,
    port: 3001,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.serviceName === selected) || services[0],
    [selected, services]
  );

  const load = async (nextDepth = depth) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchServices(nextDepth);
      const nextServices = response.data || [];
      setServices(nextServices);
      setSelected((prev) => {
        if (prev && nextServices.some((service) => service.serviceName === prev)) {
          return prev;
        }
        return nextServices[0]?.serviceName || "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch services");
      setServices([]);
      setSelected("");
    } finally {
      setLoading(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteService({ projectPath: deleteTarget.root });
      toast.success(`Deleted ${deleteTarget.serviceName} successfully.`);
      setDeleteTarget(null);
      await load(depth);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete service");
    } finally {
      setDeleteLoading(false);
    }
  };

  const submitCreate = async () => {
    const normalizedServiceName = serviceNameInput.trim();
    if (!normalizedServiceName) {
      setCreateError("Service name is required.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(normalizedServiceName)) {
      setCreateError("Service name can contain only letters, numbers, '-' and '_'.");
      return;
    }
    if (
      createForm.port !== undefined &&
      (!Number.isInteger(createForm.port) || createForm.port < 1 || createForm.port > 65535)
    ) {
      setCreateError("Port must be between 1 and 65535.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createService({
        ...createForm,
        projectPath: `apps/${normalizedServiceName}`,
      });
      setShowCreate(false);
      setServiceNameInput("");
      setCreateForm((prev) => ({ ...prev, projectPath: "", port: 3001 }));
      await load(depth);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setCreateLoading(false);
    }
  };


  useEffect(() => {
    if (open) {
      void load(5);
    }
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-indigo-950/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-[95vw] max-w-6xl max-h-[85vh] bg-white rounded-3xl shadow-[0_30px_80px_rgba(15,23,42,0.25)] border border-indigo-100 flex flex-col overflow-hidden transform animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-50 bg-gradient-to-r from-indigo-50 via-white to-indigo-50">
          <div>
            <div className="text-lg font-black text-gray-800 tracking-tight">Services Explorer</div>
            <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
              Folder Structure Snapshot
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-indigo-600 md:flex">
              {services.length} services
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all"
            >
              Create Service
            </button>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Depth
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value) || 1)}
              className="w-20 text-sm border-2 border-gray-300 rounded-lg bg-white px-2 py-1.5 text-gray-900 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={() => load(depth)}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all"
              disabled={loading}
            >
              {loading ? "Loading..." : "Load"}
            </button>
            <button
              className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-indigo-600 transition-all active:scale-95"
              onClick={onClose}
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

        <div className="flex-1 grid grid-cols-[280px_1fr] gap-0 min-h-0">
          <div className="border-r border-gray-100 bg-gradient-to-b from-white to-slate-50/60 p-4 overflow-auto">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Services
            </div>
            <div className="space-y-1.5">
              {services.map((service) => (
                <button
                  key={service.serviceName}
                  onClick={() => setSelected(service.serviceName)}
                  className={`group w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    service.serviceName === selectedService?.serviceName
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-50 text-gray-700 hover:bg-indigo-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{service.serviceName}</span>
                        {service.hasProjectJson && (
                          <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            NX
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-70 mt-1 truncate">{service.root}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${service.serviceName}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteError(null);
                        setDeleteTarget(service);
                      }}
                      className={`shrink-0 rounded-md border p-1.5 transition-all ${
                        service.serviceName === selectedService?.serviceName
                          ? "border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                          : "border-red-100 bg-white text-red-500 opacity-0 shadow-sm group-hover:opacity-100 group-focus-within:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              ))}
              {services.length === 0 && !loading && (
                <div className="text-xs text-gray-400">No services found.</div>
              )}
            </div>
          </div>

          <div className="p-6 overflow-auto bg-gradient-to-br from-gray-50 via-white to-indigo-50/40">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            {loading && <div className="text-sm text-gray-500">Loading services...</div>}
            {!loading && selectedService && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-800">
                      {selectedService.serviceName}
                    </div>
                    <div className="text-xs text-gray-500">Root: {selectedService.root}</div>
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest">
                    {selectedService.nxProjectName}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter by name or path..."
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                      {query ? "Filtering" : "Search"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    Clear
                  </button>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Structure
                  </div>
                  <div className="space-y-2">
                    {selectedService.structure?.length ? (
                      selectedService.structure.map((node) => (
                        <TreeItem key={node.path} node={node} depth={0} query={query} />
                      ))
                    ) : (
                      <div className="text-xs text-gray-400">No structure available.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showCreate && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]">
            <div className="absolute right-0 top-0 h-full w-[420px] max-w-[90vw] bg-white border-l border-emerald-100 shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-50 bg-emerald-50/40">
                <div>
                  <div className="text-sm font-bold text-gray-800">Create Service</div>
                  <div className="text-xs text-gray-500">Defaults: express / esbuild / eslint</div>
                </div>
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70"
                  onClick={() => setShowCreate(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
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

              <div className="p-6 space-y-4 overflow-auto h-[calc(100%-120px)]">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                    Service Name
                  </label>
                  <input
                    className="w-full text-sm border-2 border-gray-200 rounded-lg bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-400"
                    value={serviceNameInput}
                    onChange={(e) => setServiceNameInput(e.target.value)}
                    placeholder="utilities"
                  />
                  <div className="mt-1 text-[11px] text-gray-400">Created under <span className="font-mono">apps/{serviceNameInput.trim() || "service-name"}</span></div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                    Port
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    className="w-full text-sm border-2 border-gray-200 rounded-lg bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-400"
                    value={createForm.port ?? ""}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        port: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    placeholder="3001"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                    Project Name/Root Format
                  </label>
                  <input
                    className="w-full text-sm border-2 border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700"
                    value={createForm.projectNameAndRootFormat}
                    placeholder="as-provided"
                    readOnly
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                      Framework
                    </label>
                    <input
                      className="w-full text-sm border-2 border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 cursor-not-allowed"
                      value={createForm.framework}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                      Bundler
                    </label>
                    <input
                      className="w-full text-sm border-2 border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 cursor-not-allowed"
                      value={createForm.bundler}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                      Unit Test Runner
                    </label>
                    <input
                      className="w-full text-sm border-2 border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 cursor-not-allowed"
                      value={createForm.unitTestRunner}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                      E2E Test Runner
                    </label>
                    <input
                      className="w-full text-sm border-2 border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 cursor-not-allowed"
                      value={createForm.e2eTestRunner}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                      Linter
                    </label>
                    <input
                      className="w-full text-sm border-2 border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 cursor-not-allowed"
                      value={createForm.linter}
                      readOnly
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      id="dryRun"
                      type="checkbox"
                      checked={createForm.dryRun}
                      disabled
                    />
                    <label htmlFor="dryRun" className="text-xs text-gray-600">
                      Dry Run
                    </label>
                  </div>
                </div>

                {createError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">
                    {createError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-emerald-50 bg-emerald-50/40 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-gray-600 hover:bg-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCreate}
                  disabled={createLoading}
                  className="px-4 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {createLoading ? "Creating..." : "Create Service"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteLoading) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete <strong>{deleteTarget.serviceName}</strong> from{" "}
                  <span className="font-mono text-xs">{deleteTarget.root}</span>.
                </>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
            {deleteError ? (
              <div className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-600">
                {deleteError}
              </div>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteLoading}
              onClick={(event) => {
                event.preventDefault();
                void submitDelete();
              }}
            >
              {deleteLoading ? "Deleting..." : "Delete Service"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
