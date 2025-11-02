#!/usr/bin/env node

import { RuuviTrmnlApp } from "@/core/app";

const app = new RuuviTrmnlApp(true);
app.start().catch((error) => {
  console.error("Failed to start RuuviTRMNL application:", error);
  process.exit(1);
});
