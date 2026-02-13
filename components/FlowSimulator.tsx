"use client";

import { useMemo, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

import { useFlowStore } from "@/store/flow/flowStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FlowSimulatorProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FlowOption = {
  id: string;
  label: string;
};

export default function FlowSimulator({ isOpen, onClose }: FlowSimulatorProps) {
  const nodes = useFlowStore((state) => state.nodes);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [responses, setResponses] = useState<string[]>([]);

  const flowOptions = useMemo<FlowOption[]>(() => {
    const options: FlowOption[] = [];

    const rootGroups = nodes.filter((node) => node.type === "group" && !node.parentNode);
    rootGroups.forEach((group) => {
      const groupName = String((group.data as Record<string, unknown>)?.name ?? "").trim();
      const startChild = nodes.find((n) => n.parentNode === group.id && n.type === "start");
      const flowName = String(
        (startChild?.data as Record<string, unknown> | undefined)?.flowName ?? ""
      ).trim();
      const label = flowName || groupName || `Group ${group.id.slice(0, 6)}`;
      options.push({ id: group.id, label });
    });

    return options;
  }, [nodes]);

  const resolvedSelectedFlowId = useMemo(() => {
    if (flowOptions.length === 0) return "";
    const exists = flowOptions.some((option) => option.id === selectedFlowId);
    return exists ? selectedFlowId : flowOptions[0].id;
  }, [flowOptions, selectedFlowId]);

  const selectedFlowLabel = useMemo(() => {
    const selected = flowOptions.find((option) => option.id === resolvedSelectedFlowId);
    return selected?.label ?? "";
  }, [flowOptions, resolvedSelectedFlowId]);

  const handleSend = () => {
    if (!resolvedSelectedFlowId) return;
    const text = userInput.trim();
    if (!text) return;
    const next = `Incoming response (${selectedFlowLabel}): ${text}`;
    setResponses((current) => [next, ...current].slice(0, 30));
    setUserInput("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-slate-50 px-6 py-5 dark:bg-slate-900">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            Flow Simulator
          </DialogTitle>
          <DialogDescription>
            Pick a root flow/group, submit input, and inspect incoming responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Flow / Group
            </label>
            <Select value={resolvedSelectedFlowId} onValueChange={setSelectedFlowId}>
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue placeholder="Select one flow" />
              </SelectTrigger>
              <SelectContent>
                {flowOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              User Input
            </label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                placeholder="Enter test input..."
                value={userInput}
                disabled={!resolvedSelectedFlowId}
                onChange={(event) => setUserInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleSend}
                className="gap-2 cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={!resolvedSelectedFlowId}
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Bot className="h-4 w-4 text-indigo-500" />
                Incoming Response
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setResponses([])}
                disabled={responses.length === 0}
              >
                Clear
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-xl border bg-muted/20 p-3">
              {responses.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background px-3 py-8 text-center text-sm text-muted-foreground">
                  No incoming response yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {responses.map((response, index) => (
                    <div
                      key={`response-${index}`}
                      className="rounded-md border bg-background p-3 text-sm text-foreground"
                    >
                      {response}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {flowOptions.length > 0 ? (
            <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
              Tip: this simulator currently echoes test input as mock incoming response for the
              selected flow.
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              No root flow groups found. Create a flow group first, then open simulator.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
