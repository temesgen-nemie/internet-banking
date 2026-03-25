import axios, { AxiosError } from "axios";
import type { FlowJson, FlowNode } from "../store/flow/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://ussdtool.profilesage.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("ussd-auth-token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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
    const response = await api.get(
      `/admin/flows/${encodeURIComponent(flowName)}/assignable-users`,
      {
        params: payload,
      }
    );
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
    const response = await api.post(
      `/admin/flows/${encodeURIComponent(flowName)}/permissions/assign`,
      payload
    );
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
    const response = await api.post(
      `/admin/flows/${encodeURIComponent(flowName)}/permissions/revoke`,
      payload
    );
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
    projectNameAndRootFormat: string;
    framework: string;
    bundler: string;
    unitTestRunner: string;
    e2eTestRunner: string;
    linter: string;
    dryRun: boolean;
};

export const createService = async (payload: CreateServicePayload) => {
    const response = await api.post("/folder/createService", payload);
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
    const response = await api.get<{ data: FlowJson[] }>("/allFlows");
    return response.data.data;
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
    const response = await api.get<{ data: FlowJson[] }>(
      `/flows/${encodeURIComponent(flowName)}`
    );
    return response.data.data;
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
      const axiosError = error as AxiosError<{ error?: string }>;
      throw new Error(axiosError.response?.data?.error || "Backend error");
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

export const updateNodeInFlow = async (
  flowName: string,
  nodeName: string,
  nodeData: FlowNode,
  previousName?: string
) => {
  try {
    const response = await api.put(
      `/flows/${encodeURIComponent(flowName)}/nodes/${encodeURIComponent(nodeName)}`,
      {
        flowName,
        nodeName,
        previousName,
        node: nodeData,
      }
    );
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

export default api;
