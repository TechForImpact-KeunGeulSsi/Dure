#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

let output;
try {
  output = execFileSync("supabase", ["status", "-o", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  console.error("Local Supabase is not running. Start Docker and run 'supabase start'.");
  process.exit(1);
}

let status;
try {
  status = JSON.parse(output);
} catch {
  console.error("Could not parse 'supabase status -o json' output.");
  process.exit(1);
}

const required = ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"];
const missing = required.filter((key) => !status[key]);
if (missing.length > 0) {
  console.error(`Local Supabase status is missing: ${missing.join(", ")}`);
  process.exit(1);
}

const child = spawn(resolve(process.cwd(), "node_modules/.bin/next"), ["dev"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET: status.JWT_SECRET ?? "",
    APP_URL: "http://localhost:3000",
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
