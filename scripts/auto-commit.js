import { execSync } from "child_process";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function exec(command, options = {}) {
  try {
    return execSync(command, { stdio: "inherit", ...options });
  } catch (err) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

console.log("\n🔄 ChangeAIPay Auto-Commit & Push\n");

console.log("1. Checking git status...");
exec("git status");

console.log("\n2. Checking for changes...");
const status = execSync("git status --porcelain").toString();

if (!status.trim()) {
  console.log("No changes to commit.");
  rl.close();
  process.exit(0);
}

rl.question("\nEnter commit message (or press Enter for default): ", (message) => {
  const commitMsg = message.trim() || "Production upgrade: scalable architecture, AI integration, and dashboard foundations";
  
  console.log(`\n3. Staging changes...`);
  exec("git add -A");
  
  console.log(`\n4. Committing with message: "${commitMsg}"`);
  exec(`git commit -m "${commitMsg}"`);
  
  console.log("\n5. Pushing to remote...");
  try {
    exec("git push");
    console.log("\n✅ Successfully committed and pushed to GitHub!");
  } catch {
    console.log("\n⚠️  Push failed. Changes are committed locally.");
  }
  
  rl.close();
});