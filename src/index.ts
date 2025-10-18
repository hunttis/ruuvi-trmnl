#!/usr/bin/env node

import { RuuviTrmnlApp } from "./app";

// Create and start the application with console display enabled
const app = new RuuviTrmnlApp(true); // Enable console display by default

// Start the application
app.start().catch((error) => {
  console.error("Failed to start RuuviTRMNL application:", error);
  process.exit(1);
});
