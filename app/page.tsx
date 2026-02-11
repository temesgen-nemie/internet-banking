"use client";

import dynamic from 'next/dynamic';
import Navbar from '../components/Navbar';
import AuthGate from '../components/auth/AuthGate';
import InspectorPanel from '../components/inspector/InspectorPanel';
import { useFlowStore } from '../store/flow/flowStore';
import { Toaster } from 'sonner';

const FlowCanvas = dynamic(() => import('../components/FlowCanvas'), { ssr: false });

export default function Home() {
  return (
    <AuthGate>
      <div className='h-screen flex flex-col'>
        <Navbar />

        <div className='flex-1 relative'>
          <FlowCanvas />
          <Toaster position="top-right" richColors />

          {useFlowStore((s) => s.inspectorOpen) && (
            <InspectorPanel key={useFlowStore.getState().selectedNodeId} />
          )}
        </div>
      </div>
    </AuthGate>
  );
}
