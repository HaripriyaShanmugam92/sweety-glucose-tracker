// Tests - Get Route

require("dotenv").config();

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../server");
const { setupTestData } = require("./test_db");

let token;

test.before(async () => {
  const userId = await setupTestData();

  token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
});

test("Should reject request without authentication token", async () => {
  const response = await request(app).get("/api/readings");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication required");
});

test("Should reject request with invalid authentication token", async () => {
  const response = await request(app)
    .get("/api/readings")
    .set("Authorization", "Bearer invalid-token");

  assert.equal(response.status, 401);
});

test("Should retrieve all readings for the authenticated user", async () => {
  const response = await request(app)
    .get("/api/readings")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.readings));
  assert.ok(response.body.readings.length > 0);
});

test("Should return readings with the required fields", async () => {
  const response = await request(app)
    .get("/api/readings")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);

  const reading = response.body.readings[0];

  assert.ok(reading);
  assert.ok(reading.reading_date);
  assert.ok(reading.time_slot);
  assert.ok(reading.glucose_value !== undefined);
});

test.after(async () => {
  await require("../db").end();
  await require("./test_db").pool.end();
});
