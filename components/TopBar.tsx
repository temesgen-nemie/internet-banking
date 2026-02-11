"use client";

import React from "react";
import { useFlowStore } from "../store/flow/flowStore";

export default function TopBar() {
  const nodes = useFlowStore((state) => state.nodes);

  const stats = {
    total: nodes.length,
    start: nodes.filter((n) => n.type === "start").length,
    prompt: nodes.filter((n) => n.type === "prompt").length,
    action: nodes.filter((n) => n.type === "action").length,
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-6 px-6 py-3 rounded-2xl bg-white/80 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-500">
        
        {/* Total nodes */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Canvas Nodes</span>
          <span className="text-lg font-black text-gray-800 tabular-nums leading-tight">{stats.total}</span>
        </div>

        {/* Divider */}
        <div className="h-8 w-[1px] bg-gray-200/60" />

        {/* Start Count */}
        <div className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200 transition-colors group-hover:bg-orange-600 group-hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-tight">Start</span>
            <span className="text-sm font-bold text-gray-700 tabular-nums -mt-1">{stats.start}</span>
          </div>
        </div>

        {/* Prompt Count */}
        <div className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-200 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="flex flex-col">
             <span className="text-[9px] uppercase font-bold text-gray-400 tracking-tight">Prompts</span>
             <span className="text-sm font-bold text-gray-700 tabular-nums -mt-1">{stats.prompt}</span>
          </div>
        </div>

        {/* Action Count */}
        <div className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm border border-purple-200 transition-colors group-hover:bg-purple-600 group-hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 17h6"/><path d="M9 12h6"/><path d="M9 7h6"/>
            </svg>
          </div>
          <div className="flex flex-col">
             <span className="text-[9px] uppercase font-bold text-gray-400 tracking-tight">Actions</span>
             <span className="text-sm font-bold text-gray-700 tabular-nums -mt-1">{stats.action}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
