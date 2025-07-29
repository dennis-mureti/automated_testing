const request = require("supertest");
const express = require("express");
const { initialize, getDb } = require("../db");
const { app } = require("../app");

let testApp;

beforeAll(async () => {
  // Initialize database
  await initialize();
  
  // Create a new Express app instance for testing
  testApp = express();
  
  // Set up middleware and routes
  testApp.use(express.json());
  testApp.use((req, res, next) => {
    req.db = getDb();
    next();
  });
  
  // Copy routes from main app
  const router = express.Router();
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      router[middleware.route.stack[0].method](middleware.route.path, middleware.route.stack);
    }
  });
  testApp.use(router);
});

afterAll(() => {
  // Close any open database connections
  const db = getDb();
  if (db) {
    db.close();
  }
});

describe("Todo API", () => {
  test("POST /login with valid credentials", async () => {
    const response = await request(testApp)
      .post("/login")
      .send({ username: "testuser", password: "password" });
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("POST /login with invalid credentials", async () => {
    const response = await request(testApp)
      .post("/login")
      .send({ username: "wrong", password: "wrong" });
    expect(response.statusCode).toBe(401);
  });

  test("GET /items returns todos", async () => {
    const response = await request(testApp).get("/items");
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test("POST /items creates a new todo", async () => {
    const newTodo = { title: "Test todo" };
    const response = await request(testApp).post("/items").send(newTodo);
    expect(response.statusCode).toBe(200);
    expect(response.body.title).toBe(newTodo.title);
    expect(response.body.completed).toBe(false);
  });

  test("PUT /items/:id updates a todo", async () => {
    const newTodo = await request(testApp)
      .post("/items")
      .send({ title: "To update" });

    const updated = await request(testApp)
      .put(`/items/${newTodo.body.id}`)
      .send({ title: "Updated", completed: true });

    expect(updated.statusCode).toBe(200);
    expect(updated.body.title).toBe("Updated");
    expect(updated.body.completed).toBe(true);
  });

  test("DELETE /items/:id removes a todo", async () => {
    const newTodo = await request(testApp)
      .post("/items")
      .send({ title: "To delete" });

    const response = await request(testApp).delete(`/items/${newTodo.body.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
