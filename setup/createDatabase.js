const { Client } = require("pg");

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_ADMIN_USER || "postgres", // Admin user for setup
  password: process.env.DB_ADMIN_PASSWORD || "admin123456", // Admin password
};

const APP_DB_CONFIG = {
  database: process.env.DB_NAME || "economic_calendar",
  user: process.env.DB_USER || "ec_user",
  password: process.env.DB_PASSWORD || "ec_password_123",
};

class DatabaseSetup {
  constructor() {
    this.adminClient = null;
    this.appClient = null;
  }

  async createDatabaseAndUser() {
    try {
      // Connect as admin user
      this.adminClient = new Client(DB_CONFIG);
      await this.adminClient.connect();
      console.log("✅ Connected as admin user");

      // Create database
      try {
        await this.adminClient.query(
          `CREATE DATABASE ${APP_DB_CONFIG.database}`
        );
        console.log(`✅ Database '${APP_DB_CONFIG.database}' created`);
      } catch (error) {
        if (error.code === "42P04") {
          console.log(
            `ℹ️  Database '${APP_DB_CONFIG.database}' already exists`
          );
        } else {
          throw error;
        }
      }

      // Create user
      try {
        await this.adminClient.query(
          `CREATE USER ${APP_DB_CONFIG.user} WITH PASSWORD '${APP_DB_CONFIG.password}'`
        );
        console.log(`✅ User '${APP_DB_CONFIG.user}' created`);
      } catch (error) {
        if (error.code === "42710") {
          console.log(`ℹ️  User '${APP_DB_CONFIG.user}' already exists`);
          // Update password in case it changed
          await this.adminClient.query(
            `ALTER USER ${APP_DB_CONFIG.user} WITH PASSWORD '${APP_DB_CONFIG.password}'`
          );
        } else {
          throw error;
        }
      }

      // Grant database privileges
      await this.adminClient.query(
        `GRANT ALL PRIVILEGES ON DATABASE ${APP_DB_CONFIG.database} TO ${APP_DB_CONFIG.user}`
      );
      console.log(`✅ Database privileges granted to '${APP_DB_CONFIG.user}'`);

      await this.adminClient.end();

      // Connect to the specific database as admin to grant schema privileges
      this.adminClient = new Client({
        ...DB_CONFIG,
        database: APP_DB_CONFIG.database,
      });
      await this.adminClient.connect();

      // Grant schema privileges
      await this.adminClient.query(
        `GRANT ALL ON SCHEMA public TO ${APP_DB_CONFIG.user}`
      );
      await this.adminClient.query(
        `GRANT CREATE ON SCHEMA public TO ${APP_DB_CONFIG.user}`
      );
      console.log(`✅ Schema privileges granted to '${APP_DB_CONFIG.user}'`);

      await this.adminClient.end();
    } catch (error) {
      console.error("❌ Error in database/user creation:", error);
      throw error;
    }
  }

  async createTables() {
    try {
      // Connect as admin user to the application database to create tables
      this.adminClient = new Client({
        ...DB_CONFIG,
        database: APP_DB_CONFIG.database,
      });

      await this.adminClient.connect();
      console.log("✅ Connected as admin to application database");

      // Create economic_events table
      const economicEventsTable = `
      CREATE TABLE IF NOT EXISTS economic_events (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        time TIME NOT NULL,
        currency VARCHAR(10) NOT NULL,
        volatility INTEGER DEFAULT 0,
        event TEXT NOT NULL,
        fact DECIMAL(15,4),
        forecast DECIMAL(15,4),
        previous DECIMAL(15,4),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

      // Create telegram_users table
      const telegramUsersTable = `
      CREATE TABLE IF NOT EXISTS telegram_users (
        id SERIAL PRIMARY KEY,
        telegram_user_id BIGINT UNIQUE NOT NULL,
        chat_id BIGINT NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

      // Create indexes
      const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events(date);
      CREATE INDEX IF NOT EXISTS idx_economic_events_currency ON economic_events(currency);
      CREATE INDEX IF NOT EXISTS idx_telegram_users_active ON telegram_users(is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_telegram_users_chat_id ON telegram_users(chat_id);
    `;

      await this.adminClient.query(economicEventsTable);
      console.log("✅ Table economic_events created");

      await this.adminClient.query(telegramUsersTable);
      console.log("✅ Table telegram_users created");

      await this.adminClient.query(createIndexes);
      console.log("✅ Indexes created");

      // Grant all privileges on the created tables to the app user
      await this.adminClient.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${APP_DB_CONFIG.user}`
      );
      await this.adminClient.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${APP_DB_CONFIG.user}`
      );
      await this.adminClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${APP_DB_CONFIG.user}`
      );
      await this.adminClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${APP_DB_CONFIG.user}`
      );
      console.log("✅ Table and sequence privileges granted");

      await this.adminClient.end();

      // Test connection as the app user
      this.appClient = new Client({
        ...DB_CONFIG,
        database: APP_DB_CONFIG.database,
        user: APP_DB_CONFIG.user,
        password: APP_DB_CONFIG.password,
      });

      await this.appClient.connect();
      console.log("✅ Successfully tested connection as app user");

      // Test a simple query
      const result = await this.appClient.query(
        "SELECT COUNT(*) FROM economic_events"
      );
      console.log(
        `✅ App user can query tables (found ${result.rows[0].count} events)`
      );

      await this.appClient.end();
    } catch (error) {
      console.error("❌ Error creating tables:", error);
      throw error;
    }
  }

  async runFullSetup() {
    console.log("🚀 Starting PostgreSQL setup...");
    await this.createDatabaseAndUser();
    await this.createTables();
    console.log("✅ Database setup completed!");

    console.log("\n📋 Connection details:");
    console.log(`Database: ${APP_DB_CONFIG.database}`);
    console.log(`User: ${APP_DB_CONFIG.user}`);
    console.log(`Password: ${APP_DB_CONFIG.password}`);
    console.log(`Host: ${DB_CONFIG.host}`);
    console.log(`Port: ${DB_CONFIG.port}`);
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.runFullSetup().catch(console.error);
}

module.exports = DatabaseSetup;
