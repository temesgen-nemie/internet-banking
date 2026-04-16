import axios, { AxiosError } from "axios";
import type { FlowJson, FlowNode } from "../store/flow/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://ibbuilder.profilesage.com";
const AUTH_TOKEN_KEY = "ussd-auth-token";
const AUTH_STORE_KEY = "ussd-auth";
 
let isHandlingUnauthorized = false;

const isSessionAuthFailure = (error: AxiosError<ApiErrorPayload>): boolean => {
  if (error.response?.status !== 401) {
    return false;
  }

  const requestUrl = String(error.config?.url ?? "");
  if (requestUrl.includes("/auth/me") || requestUrl.includes("/auth/logout")) {
    return true;
  }

  const payload = error.response?.data;
  const message = [
    typeof payload?.error === "string" ? payload.error : "",
    typeof payload?.message === "string" ? payload.message : "",
  ]
    .join(" ")
    .trim()
    .toLowerCase();

  return (
    message.includes("invalid or expired session") ||
    message.includes("no session provided") ||
    message.includes("not authenticated")
  );
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      isSessionAuthFailure(error)
    ) {
      const hasSession =
        Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY)) ||
        Boolean(window.localStorage.getItem(AUTH_STORE_KEY));

      if (hasSession) {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(AUTH_STORE_KEY);
      }

      if (!isHandlingUnauthorized && hasSession) {
        isHandlingUnauthorized = true;
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }
    }

    return Promise.reject(error);
  }
);

type ApiErrorPayload = {
  error?: string;
  message?: string;
  details?: unknown;
  issues?: unknown;
};

type FlowPayloadBundle = {
  kind: "service-flow-bundle";
  flows?: unknown[];
};

const isFlowJson = (value: unknown): value is FlowJson => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FlowJson>;
  return (
    typeof candidate.flowName === "string" &&
    Array.isArray(candidate.nodes) &&
    typeof candidate.entryNode === "string"
  );
};

const isServiceFlowBundle = (value: unknown): value is FlowPayloadBundle => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FlowPayloadBundle>;
  return candidate.kind === "service-flow-bundle" && Array.isArray(candidate.flows);
};

const flattenFlowPayload = (value: unknown): FlowJson[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenFlowPayload(entry));
  }
  if (isFlowJson(value)) {
    return [value];
  }
  if (isServiceFlowBundle(value)) {
    return (value.flows ?? []).flatMap((flow) => flattenFlowPayload(flow));
  }
  return [];
};

const stringifyApiErrorDetails = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => stringifyApiErrorDetails(entry))
      .filter((entry): entry is string => Boolean(entry));
    return items.length > 0 ? items.join(" | ") : null;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const buildApiErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) return error.message;
    return fallback;
  }

  const axiosError = error as AxiosError<ApiErrorPayload>;
  const status = axiosError.response?.status;
  const payload = axiosError.response?.data;

  const primary =
    stringifyApiErrorDetails(payload?.error) ??
    stringifyApiErrorDetails(payload?.message) ??
    fallback;

  const details =
    stringifyApiErrorDetails(payload?.details) ??
    stringifyApiErrorDetails(payload?.issues);

  const parts = [primary];
  if (details && details !== primary) {
    parts.push(details);
  }
  if (status) {
    parts.push(`HTTP ${status}`);
  }

  return parts.join(" | ");
};

export type AuthUser = {
  userId?: string;
  username: string;
  isAdmin: boolean;
  mustChangePassword?: boolean;
  createdAt?: number;
  lastActivity?: number;
};

export type LoginResponse = {
  user: AuthUser;
  sessionId: string;
};

export type MeResponse = {
  user: AuthUser;
};

export type CurlProxyPayload = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  ignoreTls?: boolean;
  forceTls12?: boolean;
};

export const callCurlProxy = async (payload: CurlProxyPayload) => {
  try {
    const response = await api.post("/admin/flows/curlProxyController", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          "Failed to send request through proxy"
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const createFlow = async (payload: FlowJson) => {
  try {
    const response = await api.post("/flows", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Backend error");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const login = async (payload: {
  username: string;
  password: string;
}): Promise<LoginResponse> => {
  try {
    const response = await api.post<LoginResponse>("/auth/login", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Login failed");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getCurrentUser = async (): Promise<MeResponse> => {
  try {
    const response = await api.get<MeResponse>("/auth/me");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to fetch user");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const changePassword = async (payload: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) => {
  try {
    const response = await api.post("/auth/change-password", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to change password");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const logoutSession = async () => {
  try {
    const response = await api.post("/auth/logout");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to logout");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const updateNodeById = async (
  nodeId: string,
  payload: { node: unknown },
  operation?: "revert" | "merge"
) => {
  try {
    const response = await api.put(
      `/nodes/by-id/${nodeId}`,
      payload,
      operation ? { params: { operation } } : undefined
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to update node");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getUsers = async (params?: { page?: number; pageSize?: number }) => {
  try {
    const response = await api.get("/admin/users", {
      headers: { "Content-Type": "text/plain" },
      params,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to fetch users");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const createUser = async (payload: {
  username: string;
  password: string;
  isAdmin?: boolean;
}) => {
  try {
    const response = await api.post("/admin/users", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to create user");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getAssignableUsers = async (
  flowName: string,
  payload: { page: number; pageSize: number }
) => {
  try {
    const response = await api.get('/admin/flows/assignable-users', {
      params: {
        flowName,
        ...payload,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to fetch assignable users");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const assignFlowPermissions = async (
  flowName: string,
  payload: {
    targetUserId: string;
    user: { userId: string };
    permissions: { canPublish: boolean; canUpdate: boolean; canDelete: boolean };
  }
) => {
  try {
    const response = await api.post('/admin/flows/permissions/assign', {
      flowName,
      ...payload,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to assign permissions");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const revokeFlowPermissions = async (
  flowName: string,
  payload: { targetUserId: string; user: { userId: string } }
) => {
  try {
    const response = await api.post('/admin/flows/permissions/revoke', {
      flowName,
      ...payload,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to revoke permissions");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export type FlowPermissionCheckResponse = {
  hasPermission: boolean;
};

export type ServiceStructureNode = {
    name: string;
    path: string;
    type: "directory" | "file";
    children?: ServiceStructureNode[];
};

export type ServiceEntry = {
    serviceName: string;
    nxProjectName: string;
    root: string;
    port?: number | null;
    basePath?: string | null;
    hasProjectJson: boolean;
    structure: ServiceStructureNode[];
};

export type ServicesResponse = {
    data: ServiceEntry[];
    meta?: {
        count?: number;
        maxDepth?: number;
    };
};

export const fetchServices = async (depth = 5): Promise<ServicesResponse> => {
    const response = await api.get<ServicesResponse>("/folder/getServices", {
        params: { depth },
    });
    return response.data;
};

export type CreateServicePayload = {
    projectPath: string;
    basePath?: string;
    projectNameAndRootFormat: string;
    framework: string;
    bundler: string;
    unitTestRunner: string;
    e2eTestRunner: string;
    linter: string;
    dryRun: boolean;
    port?: number;
};

export const createService = async (payload: CreateServicePayload) => {
    const response = await api.post("/folder/createService", payload);
    return response.data;
};

export type DeleteServicePayload = {
    projectPath: string;
};

export const deleteService = async (payload: DeleteServicePayload) => {
    const response = await api.delete("/folder/deleteService", {
        data: payload,
    });
    return response.data;
};

export type UpdateServiceSettingsPayload = {
    projectPath: string;
    port: number;
    basePath?: string;
};

export const updateServiceSettings = async (payload: UpdateServiceSettingsPayload) => {
    const response = await api.put("/folder/updateServicePort", payload);
    return response.data;
};

export type ServiceFlowBundle = {
  kind: "service-flow-bundle";
  version: 1;
  sourceService: string;
  exportedAt: string;
  flows: Record<string, unknown>[];
};

export const exportServiceFlowBundle = async (payload: { projectPath: string }) => {
  const response = await api.post<{
    message: string;
    serviceName: string;
    bundle: ServiceFlowBundle;
  }>("/folder/exportServiceFlows", payload);
  return response.data;
};

export const importServiceFlowBundle = async (payload: {
  projectPath: string;
  bundle: ServiceFlowBundle;
}) => {
  const response = await api.post<{
    message: string;
    targetService: string;
    importedFlows: number;
  }>("/folder/importServiceFlows", payload);
  return response.data;
};

export async function checkMyFlowPermission(flowName: string, userId: string): Promise<boolean> {
  const res = await api.get<FlowPermissionCheckResponse>(
    `/flows/${encodeURIComponent(flowName)}/permissions/check`,
    {
      params: { userId },
    }
  );

  return Boolean(res.data?.hasPermission);
}

export const suspendUser = async (payload: { userId: string; suspensionReason: string }) => {
  try {
    const response = await api.post("/admin/users/suspend", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to suspend user");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const unsuspendUser = async (payload: { userId: string }) => {
  try {
    const response = await api.post("/admin/users/unsuspend", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to unsuspend user");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const unlockUser = async (payload: { userId: string }) => {
  try {
    const response = await api.post("/admin/user/unlock", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to unlock user");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const changeUsername = async (payload: { targetUserId: string; newUserName: string }) => {
  try {
    const response = await api.post("/admin/change-username/", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to change username");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const changeUserRole = async (payload: {
  targetUserId: string;
  actionType: "promote" | "demote";
}) => {
  try {
    const response = await api.post("/admin/change-role", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Failed to change role");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getAllFlows = async () => {
  try {
    const response = await api.get<{ data: unknown }>("/allFlows");
    return flattenFlowPayload(response.data.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Backend error");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getFlowByName = async (flowName: string) => {
  try {
    const response = await api.get<{ data: unknown }>(
      `/flows/${encodeURIComponent(flowName)}`
    );
    const flows = flattenFlowPayload(response.data.data);
    const matchedFlow = flows.find((flow) => flow.flowName === flowName) ?? flows[0];
    if (!matchedFlow) {
      throw new Error(`Flow not found: ${flowName}`);
    }
    return matchedFlow;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Backend error");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export type UpdateFlowPayload = FlowJson;

export const updateFlow = async (
  flowName: string,
  payload: UpdateFlowPayload,
  operation?: "revert" | "merge"
) => {
  try {
    const response = await api.post(
      `/flows/updateFlows/${encodeURIComponent(flowName)}`,
      payload,
      operation ? { params: { operation } } : undefined
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(buildApiErrorMessage(error, "Failed to update flow"));
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export type UssdResponse =
  | { ok: true; data: string }
  | { ok: false; error: string; status?: number };

export const sendUssdRequest = async (xmlRequest: string): Promise<UssdResponse> => {
  try {
    const response = await api.post("/teleussd/api/v1/ussdRequest", xmlRequest, {
      headers: { "Content-Type": "application/xml" },
      responseType: "text",
    });
    return { ok: true, data: response.data };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      return {
        ok: false,
        error:
          axiosError.response?.data?.error ||
          `HTTP error! status: ${axiosError.response?.status ?? "unknown"}`,
        status: axiosError.response?.status,
      };
    }
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "An unknown error occurred" };
  }
};

export type FlowSettingsResponse = {
  data?: {
    flowName?: string;
    baseUrl?: string;
    shortcodes?: {
      tele?: string;
      safari?: string;
    };
  };
  shortcodes?: {
    tele?: string;
    safari?: string;
  };
};

export const fetchFlowSettings = async (flowName: string): Promise<FlowSettingsResponse> => {
  try {
    const response = await api.get<FlowSettingsResponse>("/settings/fetch", {
      params: { flowName },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to fetch settings (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export interface FlowSettingsPayload {
  flowName: string;
  settings: {
    baseUrl?: string;
  };
  shortcodes?: {
    tele?: string;
    safari?: string;
  };
}

export const updateFlowSettings = async (payload: FlowSettingsPayload) => {
  try {
    const response = await api.put("/settings/update", payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to update settings (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const deleteFlow = async (flowName: string) => {
  try {
    const response = await api.delete(`/flows/${encodeURIComponent(flowName)}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Backend error");
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getLogs = async (params: { from: string; to: string; limit: number }) => {
  try {
    const response = await api.get("/admin/logs", { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error || `Failed to fetch logs (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

const normalizeExternalLogsPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return { data: payload };
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return { data: record.data };
    }
    if (Array.isArray(record.logs)) {
      return { data: record.logs };
    }
    if (Array.isArray(record.items)) {
      return { data: record.items };
    }
    return { data: [record] };
  }
  return { data: [] };
};

export const getExternalLogs = async (url: string, params: { from: string; to: string; limit: number }) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });
    return normalizeExternalLogsPayload(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          `Failed to fetch logs (${axiosError.response?.status ?? "network"})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const searchLogs = async (params: {
  q?: string;
  from?: string;
  to?: string;
  session_id?: string;
  user_id?: string;
  action?: string;
  status?: string | number;
  limit?: number;
  offset?: number;
}) => {
  try {
    const response = await api.get("/admin/logs/search", { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error || `Failed to search logs (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getAuditEvents = async (params: {
  from: string;
  to: string;
  limit: number;
  page?: number;
  q?: string;
}) => {
  try {
    const response = await api.get("/audit-events", { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to fetch audit events (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getPermissionLogs = async (params: {
  page: number;
  pageSize: number;
  flowName?: string;
  assigneeName?: string;
  adminName?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  try {
    const response = await api.get("/admin/logs/permissions", { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to fetch permission logs (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export type RedisIndexInfo = {
  name: string;
  db: number;
};

export type RedisEntry = {
  key: string;
  type: string;
  ttl: number;
  value: unknown;
};

export const deleteRedisEntry = async (payload: { db: number; key: string }) => {
  try {
    const response = await api.delete("/admin/redis/entry", { data: payload });
    return response.data as {
      data: {
        db: number;
        key: string;
        deleted: boolean;
      };
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to delete redis entry (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const deleteRedisEntries = async (payload: { db: number; pattern?: string }) => {
  try {
    const response = await api.delete("/admin/redis/entries", { data: payload });
    return response.data as {
      data: {
        db: number;
        pattern: string;
        matched: number;
        deleted: number;
      };
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to delete redis entries (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getRedisIndexes = async () => {
  try {
    const response = await api.get("/admin/redis/indexes");
    return response.data as { data: RedisIndexInfo[] };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to fetch redis indexes (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const getRedisEntries = async (params: {
  db: number;
  cursor?: string;
  pattern?: string;
  limit?: number;
}) => {
  try {
    const response = await api.get("/admin/redis/entries", { params });
    return response.data as {
      data: {
        db: number;
        cursor: string;
        hasMore: boolean;
        pattern: string;
        entries: RedisEntry[];
      };
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          `Failed to fetch redis entries (${axiosError.response?.status})`
      );
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export default api;
