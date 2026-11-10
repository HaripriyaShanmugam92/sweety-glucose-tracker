// Tests - Delete Route

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
  const response = await request(app).delete(`/api/readings/${readingId}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication required");
});

test("Should reject request with invalid authentication token", async () => {
  const response = await request(app)
    .delete(`/api/readings/${readingId}`)
    .set("Authorization", "Bearer invalid-token");

  assert.equal(response.status, 401);
});

test("Should delete reading successfully", async () => {
  const response = await request(app)
    .delete(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
});

test("Should return 404 when deleting a non-existing reading", async () => {
  const response = await request(app)
    .delete("/api/readings/999999")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 404);
});

test("Should return 404 when deleting the same reading again", async () => {
  const response = await request(app)
    .delete(`/api/readings/${readingId}`)
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 404);
});

test.after(async () => {
  await require("../db").end();
  await require("./test_db").pool.end();
});
