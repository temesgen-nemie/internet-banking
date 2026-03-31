"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

type AdminGateProps = {
  children: React.ReactNode;
  redirectTo?: string;
}; 

export default function AdminGate({
  children,
  redirectTo = "/",
}: AdminGateProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!user?.isAdmin) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router, user]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access...
      </div>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) return null;

  return <>{children}</>;
}
