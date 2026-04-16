"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FlowPermissionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowName: string | null;
};

export default function FlowPermissionsDialog({
  open,
  onOpenChange,
  flowName,
}: FlowPermissionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Flow Permissions</DialogTitle>
          <DialogDescription>
            {flowName ? `Access for ${flowName}.` : "Access information."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          Per-flow permissions are disabled. Any authenticated user can create,
          update, publish, refresh, and delete flows, groups, nodes, and
          services.
        </div>
      </DialogContent>
    </Dialog>
  );
}
