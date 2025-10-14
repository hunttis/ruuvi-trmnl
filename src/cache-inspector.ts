#!/usr/bin/env node

import { CacheManager } from "./cache-manager";
import { configManager } from "./config";

async function inspectCache() {
  console.log("🔍 RuuviTRMNL Cache Inspector\n");

  try {
    const cacheManager = new CacheManager();
    await cacheManager.initialize();

    const allTags = cacheManager.getAllCachedTags();
    console.log(`📁 Total cached tags: ${allTags.length}\n`);

    if (allTags.length === 0) {
      console.log("ℹ️  No cached data found");
      return;
    }

    // Get configuration to see which tags are allowed
    const config = configManager.getConfig();
    const allowedTagIds = Object.keys(config.ruuvi.tagAliases);

    console.log("📋 Configured tags (tagAliases):");
    for (const [tagId, alias] of Object.entries(config.ruuvi.tagAliases)) {
      console.log(`  • ${tagId}: ${alias}`);
    }
    console.log();

    // Show cache statistics
    const stats = cacheManager.getCacheStatsForAllowedTags(allowedTagIds);
    console.log("📊 Cache Statistics:");
    console.log(`  • Total cached tags: ${stats.totalTags}`);
    console.log(`  • Allowed tags (in config): ${stats.allowedTags}`);
    console.log(`  • Pending to send: ${stats.pendingSend}`);
    console.log();

    // Show all cached tags with their status
    console.log("🏷️  All Cached Tags:");
    allTags.forEach((tag) => {
      const isAllowed = allowedTagIds.includes(tag.id);
      const allowedIcon = isAllowed ? "✅" : "❌";
      const temp = tag.temperature?.toFixed(1) ?? "N/A";
      const humidity = tag.humidity?.toFixed(0) ?? "N/A";
      const lastUpdate = new Date(tag.lastUpdated).toLocaleString();

      console.log(`  ${allowedIcon} ${tag.name} (${tag.id})`);
      console.log(`     ${temp}°C, ${humidity}%, Last: ${lastUpdate}`);
      console.log(`     Status: ${tag.status}`);
    });

    // Show tags that would be sent next cycle
    const changedTags = cacheManager.getChangedTags(allowedTagIds);
    console.log(`\n📤 Tags to be sent next cycle: ${changedTags.length}`);
    changedTags.forEach((tag) => {
      const temp = tag.temperature?.toFixed(1) ?? "N/A";
      const humidity = tag.humidity?.toFixed(0) ?? "N/A";
      console.log(`  • ${tag.name}: ${temp}°C, ${humidity}%`);
    });
  } catch (error) {
    console.error("❌ Error inspecting cache:", error);
  }
}

// CLI argument handling
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("🔍 RuuviTRMNL Cache Inspector");
  console.log("");
  console.log("Usage: npm run cache:inspect");
  console.log("");
  console.log("Shows current cache status including:");
  console.log("• Cached tag data and statistics");
  console.log("• Which tags are configured for sending (tagAliases)");
  console.log("• Which tags have changes pending to be sent");
  process.exit(0);
}

inspectCache().catch(console.error);
