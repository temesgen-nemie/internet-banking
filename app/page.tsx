"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import InspectorPanel from "../components/inspector/InspectorPanel";
import { useFlowStore } from "../store/flow/flowStore";
import { useAuthStore } from "../store/authStore";
import { Toaster } from "sonner";

const FlowCanvas = dynamic(() => import("../components/FlowCanvas"), {
  ssr: false,
});

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const inspectorOpen = useFlowStore((s) => s.inspectorOpen);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      <Navbar />

      <div className="relative flex-1">
        <FlowCanvas />
        <Toaster position="top-right" richColors />

        {inspectorOpen && <InspectorPanel key={selectedNodeId} />}
      </div>
    </div>
  );
}
