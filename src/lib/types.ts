export interface TrmnlWebhookPayload {
  merge_variables: Record<string, any>;
  merge_strategy?: "replace" | "deep_merge" | "stream";
  stream_limit?: number;
}

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
  lastTemperatureUpdate?: string;
  status: "active" | "stale" | "offline";
}

export interface RuuviCollectionData {
  ruuvi_tags: any[];
  lastRefresh: string;
  totalTags: number;
  scanDuration?: number;
  weather?: WeatherData;
}

export interface TrmnlWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
  statusCode?: number;
}

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

export interface WeatherHour {
  time: string; // "HH:MM" in Helsinki time
  temperature: number;
  feelsLike: number;
  symbol: number; // FMI WeatherSymbol3 code
  symbolText: string;
  precipitation: number; // mm/h
}

export interface WeatherData {
  location: string;
  current: WeatherHour;
  forecast: WeatherHour[]; // next N hours
  fetchedAt: string;
}

export interface RawRuuviTag {
  id: string;
  address: string;
  addressType: string;
  connectable: boolean;
  on(event: "updated", listener: (data: RawRuuviData) => void): void;
}
