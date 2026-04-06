"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Bolt, Code2, FileUp, MessageSquare } from "lucide-react";
import { useFlowStore } from "@/store/flow/flowStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function NodeToolbar() {
  const { addNode, rfInstance, nodes, currentSubflowId, importSubflow } = useFlowStore();

  const hasStart = nodes.some(
    (n) => n.type === "start" && (n.parentNode || null) === (currentSubflowId || null)
  );

  const getCenteredPosition = useCallback(() => {
    if (rfInstance) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const position = rfInstance.project({
        x: centerX,
        y: centerY,
      });

      return {
        x: position.x + (Math.random() * 40 - 20),
        y: position.y + (Math.random() * 40 - 20),
      };
    }

    const x = Math.floor(Math.random() * 800) - 400;
    const y = Math.floor(Math.random() * 600) - 300;
    return { x, y };
  }, [rfInstance]);

  const handleAddNode = useCallback(
    (type: "prompt" | "action" | "script" | "functionCall" | "start" | "condition" | "router") => {
      if (type === "start" && hasStart) return;
      const data =
        type === "prompt"
          ? { message: "", nextNode: { routes: [], default: "" } }
          : type === "action"
            ? { endpoint: "", requestSource: "api" as const }
            : type === "script"
              ? { name: "", script: "", timeoutMs: 25, nextNode: "", routes: [] }
              : type === "functionCall"
                ? { name: "", functionName: "", args: {}, saveAs: "", nextNode: "" }
              : type === "condition"
                ? { name: "", nextNode: { routes: [], default: "" } }
                : type === "router"
                  ? {
                      name: "",
                      url: "",
                      method: "POST",
                      sessionMode: "required",
                      headers: {},
                      apiBody: {},
                      apiBodyRaw: "",
                      bodyMode: "json",
                      responseMapping: {},
                      nextNode: { routes: [], default: "" },
                    }
                  : { flowName: "", entryNode: "" };

      addNode({
        id: uuidv4(),
        type,
        position: getCenteredPosition(),
        data,
        parentNode: currentSubflowId ?? undefined,
      });
    },
    [addNode, currentSubflowId, getCenteredPosition, hasStart]
  );

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    nodeType: "prompt" | "action" | "script" | "functionCall" | "start" | "condition" | "router"
  ) => {
    if (nodeType === "start" && hasStart) return;
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs uppercase tracking-wide text-muted-foreground md:inline">
        Nodes
      </span>
      <div className="hidden items-center gap-2 md:flex">
        <button
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          draggable
          onDragStart={(e) => handleDragStart(e, "prompt")}
          onClick={() => handleAddNode("prompt")}
        >
          <span className="rounded-sm bg-indigo-700 p-1">
            <MessageSquare className="h-4 w-4 text-white" />
          </span>
          Prompt
        </button>
        <button
          className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
          draggable
          onDragStart={(e) => handleDragStart(e, "action")}
          onClick={() => handleAddNode("action")}
        >
          <span className="rounded-sm bg-emerald-700 p-1">
            <Bolt className="h-4 w-4 text-white" />
          </span>
          Action
        </button>
        <button
          className="flex items-center gap-2 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 cursor-pointer"
          draggable
          onDragStart={(e) => handleDragStart(e, "script")}
          onClick={() => handleAddNode("script")}
        >
          <span className="rounded-sm bg-cyan-700 p-1">
            <Code2 className="h-4 w-4 text-white" />
          </span>
          Script
        </button>
        <button
          className="flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
          draggable
          onDragStart={(e) => handleDragStart(e, "functionCall")}
          onClick={() => handleAddNode("functionCall")}
        >
          <span className="rounded-sm bg-teal-700 p-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 7h8" />
              <path d="M8 12h8" />
              <path d="M8 17h8" />
              <path d="M5 5v14" />
              <path d="M19 5v14" />
            </svg>
          </span>
          Function
        </button>
        <button
          className="flex items-center gap-2 rounded-md bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-700 cursor-pointer"
          draggable
          onDragStart={(e) => handleDragStart(e, "condition")}
          onClick={() => handleAddNode("condition")}
        >
          <span className="rounded-sm bg-pink-700 p-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3v12" />
              <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
              <path d="M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6" />
              <path d="M18 19a3 3 0 1 1-2.14-5.18" />
            </svg>
          </span>
          Condition
        </button>
        <button
          className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 cursor-pointer"
          draggable
          onDragStart={(e) => handleDragStart(e, "router")}
          onClick={() => handleAddNode("router")}
        >
          <span className="rounded-sm bg-orange-700 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3v12" /><path d="M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6" /><path d="M18 3a3 3 0 1 1-2.2 5" /><path d="M18 13a3 3 0 1 0 2.2 5" /><path d="M8.5 8.5 15.5 5.5" /><path d="M8.5 16.5 15.5 19.5" />
            </svg>
          </span>
          Router
        </button>
        {/* <button
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
            hasStart
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          draggable={!hasStart}
          onDragStart={(e) => handleDragStart(e, "start")}
          onClick={() => handleAddNode("start")}
          disabled={hasStart}
        >
          <span
            className={`rounded-sm p-1 ${
              hasStart ? "bg-muted-foreground/30" : "bg-blue-700"
            }`}
          >
            <PlayCircle className="h-4 w-4 text-white" />
          </span>
          Start
        </button> */}
        <div className="h-6 w-px bg-border mx-1" />
        <div className="relative group">
          <input
            type="file"
            accept=".json"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (event) => {
                const text = event.target?.result;
                if (typeof text === "string") {
                  importSubflow(text, getCenteredPosition());
                }
              };
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
          <button className="flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-all shadow-sm group-hover:shadow group-active:scale-95">
            <span className="rounded-sm bg-amber-700 p-1">
              <FileUp className="h-4 w-4 text-white" />
            </span>
            Import
          </button>
        </div>
      </div>
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted cursor-pointer"
            >
              Nodes
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleAddNode("prompt")}>
              Prompt
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleAddNode("action")}>
              Action
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleAddNode("script")}>
              Script
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => handleAddNode("functionCall")}
            >
              Function
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleAddNode("condition")}>
              Condition
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => handleAddNode("router")}>
              Router
            </DropdownMenuItem>
            {/* <DropdownMenuItem
              className={`cursor-pointer ${
                hasStart ? "opacity-50 pointer-events-none" : ""
              }`}
              onClick={() => handleAddNode("start")}
            >
              Start
            </DropdownMenuItem> */}
            <DropdownMenuItem className="relative cursor-pointer">
              <input
                type="file"
                accept=".json"
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const text = event.target?.result;
                    if (typeof text === "string") {
                      importSubflow(text, getCenteredPosition());
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
              Import
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
