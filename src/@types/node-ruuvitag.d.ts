// Type definitions for node-ruuvitag
declare module "node-ruuvitag" {
  import { EventEmitter } from "events";

  interface RuuviData {
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

  interface RuuviTag extends EventEmitter {
    id: string;
    address: string;
    addressType: string;
    connectable: boolean;
    on(event: "updated", listener: (data: RuuviData) => void): this;
  }

  interface RuuviModule extends EventEmitter {
    on(event: "found", listener: (tag: RuuviTag) => void): this;
    on(event: "warning", listener: (message: string) => void): this;
    findTags(): Promise<RuuviTag[]>;
  }

  const ruuvi: RuuviModule;
  export = ruuvi;
}
