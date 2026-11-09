// Tests - test_db.js

const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcrypt");

require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.TEST_DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Read test data
const testData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "test_data.json"), "utf8"),
);

async function setupTestData() {
  try {
    // Remove previous test user and readings
    await pool.query("DELETE FROM users WHERE email = $1", [
      testData.user.email,
    ]);

    // Hash password
    const hashedPassword = await bcrypt.hash(testData.user.password, 10);

    // Insert test user
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [testData.user.name, testData.user.email, hashedPassword],
    );

    const userId = userResult.rows[0].id;

    // Insert test readings
    for (const reading of testData.readings) {
      await pool.query(
        `INSERT INTO readings
         (user_id, reading_date, time_slot, glucose_value)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          reading.reading_date,
          reading.time_slot,
          reading.glucose_value,
        ],
      );
    }

    console.log("Test data inserted successfully.");

    return userId;
  } catch (error) {
    console.error("Test database setup failed:", error.message);
    throw error;
  }
}

module.exports = { pool, setupTestData };
