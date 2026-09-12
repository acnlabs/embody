export type Card = {
  alias: string;
  hub: string;
  mode?: string;
  startable?: boolean;
  preview?: string;
  onnx?: string;
};

export type BodyShow = {
  id: string;
  name?: string;
  kind: string;
  origin: string;
  bound_agent_id: string;
  session_running?: boolean;
  cards?: Card[];
  numbers?: Record<string, unknown> | null;
  numbers_error?: string;
  next?: string;
  note?: string;
  pushed_at?: string;
};
