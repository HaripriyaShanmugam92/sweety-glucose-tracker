// Tests - Readings Reports

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

// Daily report
test("GET daily report successfully", async () => {
  const response = await request(app)
    .get("/api/readings/report/daily?date=2026-11-08")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.date, "2026-11-08");
  assert.ok(response.body.report);
  assert.ok(Array.isArray(response.body.readings));

  assert.equal(typeof response.body.report.count, "number");
  assert.equal(typeof response.body.report.highest, "number");
  assert.equal(typeof response.body.report.lowest, "number");
  assert.equal(typeof response.body.report.average, "number");
});

// Daily report validation
test("Daily report without date should return 400", async () => {
  const response = await request(app)
    .get("/api/readings/report/daily")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 400);
});

test("Daily report with invalid date should return 400", async () => {
  const response = await request(app)
    .get("/api/readings/report/daily?date=invalid")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 400);
});

// Month-to-date report
test("GET month-to-date report successfully", async () => {
  const response = await request(app)
    .get("/api/readings/report/month-to-date?date=2026-11-08")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.start_date, "2026-11-01");
  assert.equal(response.body.end_date, "2026-11-08");
  assert.ok(response.body.report);
  assert.ok(Array.isArray(response.body.readings));
});

// Previous month report
test("GET previous month report successfully", async () => {
  const response = await request(app)
    .get("/api/readings/report/monthly")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.report);
  assert.ok(Array.isArray(response.body.readings));
});

// Empty report
test("Daily report with no readings should return empty statistics", async () => {
  const response = await request(app)
    .get("/api/readings/report/daily?date=2026-11-09")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.report.count, 0);
  assert.equal(response.body.readings.length, 0);
});

// Authentication
test("Reports without token should return 401", async () => {
  const response = await request(app).get(
    "/api/readings/report/daily?date=2026-11-08",
  );

  assert.equal(response.status, 401);
});

test.after(async () => {
  await require("../db").end();
  await require("./test_db").pool.end();
});
