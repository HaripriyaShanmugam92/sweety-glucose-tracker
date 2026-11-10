// Tests - Put Route

require("dotenv").config();

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../server");
const { setupTestData } = require("./test_db");

let token;
let readingId;

test.before(async () => {
  const userId = await setupTestData();

  token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const response = await request(app)
    .get("/api/readings")
    .set("Authorization", `Bearer ${token}`);

  readingId = response.body.readings[0].id;
});

test("Should reject request without authentication token", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .send({ glucose_value: 120 });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication required");
});

test("Should reject request with invalid authentication token", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", "Bearer invalid-token")
    .send({ glucose_value: 120 });

  assert.equal(response.status, 401);
});

test("Should update glucose reading successfully", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ glucose_value: 120 });

  assert.equal(response.status, 200);
});

test("Should reject glucose value below 40", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ glucose_value: 30 });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Value must be between 40 and 600 mg/dl.",
  );
});

test("Should reject glucose value above 600", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ glucose_value: 700 });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Value must be between 40 and 600 mg/dl.",
  );
});

test("Should reject decimal glucose value", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ glucose_value: 99.9 });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Value must be between 40 and 600 mg/dl.",
  );
});

test("Should reject invalid time slot", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ time_slot: "Invalid-slot" });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors.time_slot, "Invalid time slot.");
});

test("Should reject future reading date", async () => {
  const response = await request(app)
    .put(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ reading_date: "2027-11-09" });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.reading_date,
    "Date cannot be in the future.",
  );
});

test("Should return 404 for a non-existing reading", async () => {
  const response = await request(app)
    .put("/api/readings/999999")
    .set("Authorization", `Bearer ${token}`)
    .send({ glucose_value: 120 });

  assert.equal(response.status, 404);
});

test.after(async () => {
  await require("../db").end();
  await require("./test_db").pool.end();
});
