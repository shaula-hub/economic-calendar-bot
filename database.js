const { Pool } = require("pg");
require("dotenv").config();

class Database {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || "ec_user",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "economic_calendar",
      password: process.env.DB_PASSWORD || "ec_password_123",
      port: process.env.DB_PORT || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      console.error("Unexpected database error:", err);
    });
  }

  async query(text, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  async createTables() {
    // Tables already exist, just test connection
    try {
      await this.query("SELECT 1");
      console.log("✅ Database connection verified");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }
}

module.exports = Database;
