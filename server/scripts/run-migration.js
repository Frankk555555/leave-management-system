const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { testConnection } = require("../config/database");

async function runMigration() {
  try {
    console.log("Connecting and verifying database schema...");
    await testConnection();
    console.log("✅ Schema verification & migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

