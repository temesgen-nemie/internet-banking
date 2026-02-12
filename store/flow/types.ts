import { type Edge, type Node } from "reactflow";

export type FlowRoute = {
  when?: Record<string, unknown>;
  gotoFlow?: string;
  goto?: string;
  gotoId?: string;
  toMainMenu?: boolean;
  isGoBack?: boolean;
  goBackTarget?: string;
  goBackToFlow?: string;
};

export type FlowNode = {
  id: string;
  name?: string;
  type: string;
  message?: string;
  persistByIndex?: boolean;
  persistByIndexValue?: string;
  persistSourceField?: string;
  persistFieldName?: string;
  validateIndexedList?: boolean;
  indexedListVar?: string;
  invalidInputMessage?: string;
  emptyInputMessage?: string;
  inputType?: "NON_ZERO_FLOAT" | "NON_ZERO_INT" | "FLOAT" | "INTEGER" | "STRING";
  invalidInputTypeMessage?: string;
  inputValidationEnabled?: boolean;
  persistInput?: boolean;
  persistInputAs?: string;
  script?: string;
  timeoutMs?: number;
  scriptRoutes?: Array<{ key?: string; goto?: string; gotoId?: string }>;
  endpoint?: string;
  method?: string;
  curl?: string;
  wsCurl?: string;
  requestSource?: "api" | "local" | "ws";
  wsUrl?: string;
  wsProtocols?: string[];
  wsMessage?: string;
  wsLastMessage?: string;
  dataSource?: string;
  field?: string;
  outputVar?: string;
  fields?: string[];
  outputVars?: string[];
  format?: "indexedList" | "singleValue";
  headers?: Record<string, unknown>;
  apiBody?: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
  persistResponseMapping?: boolean;
  encryptInput?: boolean;
  responseType?: "CONTINUE" | "END";
  nextNode?: string | { routes?: FlowRoute[]; default?: string; defaultId?: string };
  nextNodeId?: string;
  isMainMenu?: boolean;
};

export type FlowJson = {
  flowName: string;
  entryNode: string;
  entryNodeId: string;
  nodes: FlowNode[];
  visualState?: {
    nodes: Node[];
    edges: Edge[];
  };
};
