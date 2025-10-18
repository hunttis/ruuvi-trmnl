// TRMNL Webhook Types
export interface TrmnlWebhookPayload {
  merge_variables: Record<string, any>;
  merge_strategy?: "replace" | "deep_merge" | "stream";
  stream_limit?: number;
}

// RuuviTag Data Types
export interface RuuviTagData {
  id: string;
  name: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  battery?: number;
  signal?: number;
  accelerationX?: number;
  accelerationY?: number;
  accelerationZ?: number;
  lastUpdated: string;
  lastTemperatureUpdate?: string; // Timestamp of most recent temperature reading
  status: "active" | "stale" | "offline";
}

export interface RuuviCollectionData {
  ruuvi_tags: RuuviTagData[];
  lastRefresh: string;
  totalTags: number;
  scanDuration?: number;
}

// HTTP Response Types
export interface TrmnlWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Utility type for RuuviTag raw data from node-ruuvitag
export interface RawRuuviData {
  url?: string;
  temperature?: number;
  pressure?: number;
  humidity?: number;
  eddystoneId?: string;
  rssi?: number;
  battery?: number;
  accelerationX?: number;
  accelerationY?: number;
  accelerationZ?: number;
  txPower?: number;
  movementCounter?: number;
  measurementSequenceNumber?: number;
  mac?: string;
  dataFormat?: number;
}

export interface RawRuuviTag {
  id: string;
  address: string;
  addressType: string;
  connectable: boolean;
  on(event: "updated", listener: (data: RawRuuviData) => void): void;
}
