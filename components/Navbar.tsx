"use client";

import { useState } from "react";
import { BarChart3, ShieldCheck, MoreHorizontal } from "lucide-react";
import { ModeToggle } from "./nav-items/ModeToggle";
import FlowSimulator from "./FlowSimulator";
import LogsModal from "./logs/LogsModal";
import AuditModal from "./audit/AuditModal";
import NodeToolbar from "./nav-items/NodeToolbar";
import UserMenu from "./nav-items/UserMenu";
import ServicesBrowserModal from "./modals/ServicesBrowserModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full bg-card/95 text-card-foreground border-b border-border shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2 md:px-6">
        <NodeToolbar />

        <div className="hidden flex-1 items-center justify-center gap-2 md:flex">
          <button
            onClick={() => setServicesOpen(true)}
            className="flex items-center gap-2 py-2.5 rounded-md bg-linear-to-r from-slate-600 to-slate-700 px-4 text-xs font-semibold text-white hover:from-slate-700 hover:to-slate-800 cursor-pointer shadow-md hover:shadow-lg transition-all"
          >
            Services
          </button>
          <button
            onClick={() => setSimulatorOpen(true)}
            className="flex items-center gap-2 py-2.5 rounded-md bg-linear-to-r from-purple-600 to-indigo-600 px-4 text-xs font-semibold text-white hover:from-purple-700 hover:to-indigo-700 cursor-pointer shadow-md hover:shadow-lg transition-all"
          >
            Flow Simulator
          </button>
          <button
            onClick={() => setLogsOpen(true)}
            className="flex items-center gap-2 rounded-md bg-linear-to-r from-indigo-500/80 via-purple-500/80 to-violet-500/80 px-4 py-1.5 text-xs font-semibold text-white/90 shadow-sm shadow-indigo-200/30 backdrop-blur hover:from-indigo-500 hover:via-purple-500 hover:to-violet-500 transition-all cursor-pointer"
          >
            <span className="rounded-sm bg-white/20 p-1">
              <BarChart3 className="h-4 w-4 text-white" />
            </span>
            Logs
          </button>
          <button
            onClick={() => setAuditOpen(true)}
            className="flex items-center gap-2 rounded-md bg-linear-to-r from-emerald-500/80 via-teal-500/80 to-cyan-500/80 px-4 py-1.5 text-xs font-semibold text-white/90 shadow-sm shadow-emerald-200/30 backdrop-blur hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 transition-all cursor-pointer"
          >
            <span className="rounded-sm bg-white/20 p-1">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            Audit Events
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted cursor-pointer"
                >
                  Actions
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem className="cursor-pointer" onClick={() => setServicesOpen(true)}>
                  Services
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setSimulatorOpen(true)}>
                  Flow Simulator
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setLogsOpen(true)}>
                  Logs
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setAuditOpen(true)}>
                  Audit Events
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ModeToggle />
          <UserMenu />
        </div>
      </div>

      {/* Flow Simulator */}
      <FlowSimulator isOpen={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
      <ServicesBrowserModal open={servicesOpen} onClose={() => setServicesOpen(false)} />
      <LogsModal open={logsOpen} onOpenChange={setLogsOpen} />
      <AuditModal open={auditOpen} onOpenChange={setAuditOpen} />
    </nav>
  );
}
