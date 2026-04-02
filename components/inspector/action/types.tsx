"use client";

export type ActionRoute = {
  id: string;
  condition?: string;
  nextNodeId?: string;
};

export type ActionNodeData = {
  name?: string;
  endpoint?: string;
  method?: string;
  curl?: string;
  wsCurl?: string;
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
  apiBody?: Record<string, unknown>;
  apiBodyRaw?: string;
  bodyMode?: "json" | "soap" | "form";
  requestSource?: "api" | "local" | "ws";
  headers?: Record<string, unknown>;
  responseMapping?: Record<string, unknown>;
  persistResponseMappingKeys?: string[];
  commonManagerResponseMappingKeys?: string[];
  encryptResponseMappingKeys?: string[];
  persistManager?: "inputManager" | "commonManager";
  commonManagerSaveMode?: "flowSession" | "provided" | "generate";
  commonManagerSaveSessionId?: string;
  commonManagerSessionOutputVar?: string;
  commonManagerFetchMode?: "session" | "search";
  commonManagerFetchSessionId?: string;
  commonManagerSearchField?: string;
  commonManagerSearchValue?: string;
  routes?: ActionRoute[];
  nextNode?: string;
};

export type ActionNode = {
  id: string;
  data: ActionNodeData;
};
