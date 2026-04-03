"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(64, "Username is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(12, "Password is too long"),
});

export default function LoginForm() {
  const router = useRouter();
  const { loginUser, isAuthenticated, isLoading, error, clearError, fetchMe } =
    useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});

  useEffect(() => {
    let isMounted = true;

    void fetchMe().finally(() => {
      if (isMounted) {
        setHasCheckedSession(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchMe]);

  useEffect(() => {
    if (hasCheckedSession && isAuthenticated) {
      router.replace("/");
    }
  }, [hasCheckedSession, isAuthenticated, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

    const result = loginSchema.safeParse({
      username,
      password,
    });

    if (!result.success) {
      const nextErrors = result.error.flatten().fieldErrors;
      setFieldErrors({
        username: nextErrors.username?.[0],
        password: nextErrors.password?.[0],
      });
      return;
    }

    setFieldErrors({});
    await loginUser(result.data.username, result.data.password);
  };

  return (
    <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.8)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Sign in</h1>
          <p className="text-xs text-white/60">
            Access the USSD menu builder workspace.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex flex-col space-y-3">
          <Label className="text-xs text-white/70">Username</Label>
          <Input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (fieldErrors.username) {
                setFieldErrors((prev) => ({ ...prev, username: undefined }));
              }
            }}
            placeholder="admin"
            autoComplete="username"
            className="h-11 rounded-2xl bg-white/10 text-white placeholder:text-white/40 border-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
          />
          {fieldErrors.username && (
            <div className="text-[11px] font-medium text-rose-600">
              {fieldErrors.username}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-3">
          <Label className="text-xs text-white/70">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-11 rounded-2xl bg-white/10 text-white placeholder:text-white/40 border-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
          />
          {fieldErrors.password && (
            <div className="text-[11px] font-medium text-rose-600">
              {fieldErrors.password}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading || !hasCheckedSession}
          className="h-11 w-full rounded-2xl bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:via-violet-400 hover:to-fuchsia-400 cursor-pointer"
        >
          {!hasCheckedSession
            ? "Checking session..."
            : isLoading
              ? "Signing in..."
              : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
