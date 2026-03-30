const fs = require("fs");
const path = require("path");

const targetFile = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-dev-menu",
  "ios",
  "DevMenuViewController.swift"
);

const oldSnippet = "    let isSimulator = TARGET_IPHONE_SIMULATOR > 0\n";
const newSnippet = [
  "    #if targetEnvironment(simulator)",
  "    let isSimulator = true",
  "    #else",
  "    let isSimulator = false",
  "    #endif",
  "",
].join("\n");

if (!fs.existsSync(targetFile)) {
  console.log("[fix-expo-dev-menu] target file not found, skipping");
  process.exit(0);
}

const current = fs.readFileSync(targetFile, "utf8");

if (current.includes(newSnippet.trim())) {
  console.log("[fix-expo-dev-menu] patch already applied");
  process.exit(0);
}

if (!current.includes(oldSnippet)) {
  console.log("[fix-expo-dev-menu] expected snippet not found, skipping");
  process.exit(0);
}

const next = current.replace(oldSnippet, newSnippet);
fs.writeFileSync(targetFile, next, "utf8");
console.log("[fix-expo-dev-menu] patched DevMenuViewController.swift");
