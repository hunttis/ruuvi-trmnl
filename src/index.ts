const ruuvi = require("node-ruuvitag");

// Type definitions for better TypeScript support
type RuuviData = {
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
};

type RuuviTag = {
  id: string;
  address: string;
  addressType: string;
  connectable: boolean;
  on(event: "updated", listener: (data: RuuviData) => void): void;
};

console.log("RuuviTag Scanner Starting...");
console.log("Scanning for RuuviTag devices...\n");

// Keep track of discovered tags
const discoveredTags = new Set<string>();

// Listen for found RuuviTags
ruuvi.on("found", (tag: RuuviTag) => {
  if (!discoveredTags.has(tag.id)) {
    discoveredTags.add(tag.id);
    console.log(`Found RuuviTag!`);
    console.log(`   ID: ${tag.id}`);
    console.log(`   Address: ${tag.address}`);
    console.log(`   Address Type: ${tag.addressType}`);
    console.log(`   Connectable: ${tag.connectable}`);
    console.log("   ─────────────────────────────────\n");

    // Listen for data updates from this tag
    tag.on("updated", (data: RuuviData) => {
      const temp =
        data.temperature !== undefined
          ? `${data.temperature.toFixed(1)}°C`
          : "N/A";
      const humidity =
        data.humidity !== undefined ? `${data.humidity.toFixed(1)}%` : "N/A";

      console.log(
        `[DATA] ${tag.id.substring(
          0,
          8
        )}... | Temp: ${temp} | Humidity: ${humidity}`
      );
    });
  }
});

// Listen for warnings
ruuvi.on("warning", (message: string) => {
  console.warn(`Warning: ${message}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down RuuviTag scanner...");
  process.exit(0);
});

// Optional: Use findTags() method as an alternative approach
// This is useful if you want to get a snapshot of available tags
setTimeout(async () => {
  try {
    console.log("Attempting to find tags using findTags() method...");
    const tags = await ruuvi.findTags();
    console.log(`Found ${tags.length} RuuviTag(s) in total\n`);
  } catch (error) {
    console.log(
      "No tags found with findTags() method (this is normal if no tags are nearby)\n"
    );
  }
}, 5000);

console.log("Listening for RuuviTag broadcasts...");
console.log("Make sure your RuuviTag is nearby and broadcasting");
console.log("Press Ctrl+C to stop\n");
