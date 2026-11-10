// Tests - Post Route

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
  const response = await request(app).post("/api/readings").send({
    reading_date: "2026-11-09",
    time_slot: "Morning fasting",
    glucose_value: 100,
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication required");
});

test("Should reject request without glucose value", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2026-11-09",
      time_slot: "Morning fasting",
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Please enter a glucose value.",
  );
});

test("Should reject request with glucose value below 40", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2026-11-09",
      time_slot: "Morning fasting",
      glucose_value: 39,
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Value must be between 40 and 600 mg/dl.",
  );
});

test("Should reject request with glucose value above 600", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2026-11-09",
      time_slot: "Morning fasting",
      glucose_value: 601,
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Value must be between 40 and 600 mg/dl.",
  );
});

test("Should reject request with decimal glucose value", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2026-11-09",
      time_slot: "Morning fasting",
      glucose_value: 99.9,
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.glucose_value,
    "Value must be between 40 and 600 mg/dl.",
  );
});

test("Should reject request with invalid time slot", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2026-11-09",
      time_slot: "Invalid-slot",
      glucose_value: 100,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors.time_slot, "Invalid time slot.");
});

test("Should reject request with future date", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2027-11-09",
      time_slot: "Morning fasting",
      glucose_value: 100,
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.reading_date,
    "Date cannot be in the future.",
  );
});

test.after(async () => {
  await require("../db").end();
  await require("./test_db").pool.end();
});

test("Should reject duplicate time slot for the same date", async () => {
  const response = await request(app)
    .post("/api/readings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      reading_date: "2026-11-08",
      time_slot: "Morning fasting",
      glucose_value: 105,
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "You already have an Morning fasting reading for this date.",
  );
});
