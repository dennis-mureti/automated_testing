import { test, expect } from "@playwright/test";

test.describe("Todo App Frontend Tests", () => {
  // Mock data
  const mockTodos = [
    { id: 1, title: "Existing todo 1", completed: false },
    { id: 2, title: "Existing todo 2", completed: true },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock API responses before each test
    await page.route("http://localhost:3001/login", async (route) => {
      const request = route.request();
      const postData = await request.postDataJSON();

      if (
        postData.username === "testuser" &&
        postData.password === "password"
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "fake-jwt-token" }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid credentials" }),
        });
      }
    });

    await page.route("http://localhost:3001/items", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { data: mockTodos } }),
      });
    });

    await page.goto("http://localhost:3000");
  });

  // 1. Login Tests
  test("should login with valid credentials", async ({ page }) => {
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Verify successful login by checking todo list appears
    await expect(page.locator(".app h1")).toHaveText("Todo App");
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.fill('input[placeholder="Username"]', "wronguser");
    await page.fill('input[placeholder="Password"]', "wrongpass");
    await page.click('button[type="submit"]');

    // Verify error message appears and stays on login page
    await expect(page.locator(".error-message")).toContainText("Invalid credentials");
    await expect(page.locator(".login-container h2")).toHaveText("Login"); // Still on login page
  });

  // 2. Create New Item
  test("should create a new todo item", async ({ page }) => {
    // Login first
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Mock the POST response for new todo
    await page.route("http://localhost:3001/items", async (route) => {
      const request = route.request();
      const postData = await request.postDataJSON();

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 3,
          title: postData.title,
          completed: false,
        }),
      });
    });

    const newTodoText = "New test todo";
    await page.fill('input[placeholder="Add a new task..."]', newTodoText);
    await page.click('button[type="submit"]');

    // Verify new todo appears in list
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length + 1);
    await expect(page.locator(".todo-item:last-child .todo-text")).toContainText(newTodoText);
  });

  // 3. Edit Existing Item
  test("should edit an existing todo item", async ({ page }) => {
    // Login first
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Mock the PUT response
    await page.route("http://localhost:3001/items/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          title: "Updated todo",
          completed: false,
        }),
      });
    });

    // Click edit button
    await page
      .locator('.todo-item').first()
      .locator('.todo-edit')
      .click();
    await page
      .locator('.todo-item').first()
      .locator('.todo-text')
      .fill("Updated todo");
    await page
      .locator('.todo-item').first()
      .locator('.todo-edit')
      .press("Enter");

    // Verify update
    await expect(page.locator(".todo-item")).toContainText("Updated todo");
    await expect(page.locator(".todo-item")).not.toContainText("Existing todo 1");
  });

  // 4. Delete Item
  test("should delete a todo item", async ({ page }) => {
    // Login first
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Mock the DELETE response
    await page.route("http://localhost:3001/items/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const initialCount = await page.locator(".todo-item").count();
    await page
      .locator('.todo-item').first()
      .locator('.todo-delete')
      .click();

    // Verify deletion
    await expect(page.locator(".todo-item")).toHaveCount(initialCount - 1);
    await expect(
      page.locator('.todo-item:has-text("Existing todo 1")')
    ).not.toBeVisible();
  });

  // 5. Data Assertions
  test("should maintain data integrity after actions", async ({ page }) => {
    // Login first
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Verify initial data
    await expect(page.locator(".todo-item")).toHaveCount(2);
    await expect(page.locator(".todo-item").first()).toContainText("Existing todo 1");
    await expect(page.locator(".todo-item").nth(1)).toContainText("Existing todo 2");

    // Toggle completion status
    await page.route("http://localhost:3001/items/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          title: "Existing todo 1",
          completed: true,
        }),
      });
    });

    await page
      .locator('li:has-text("Existing todo 1") input[type="checkbox"]')
      .check();

    // Verify UI reflects completed state
    await expect(page.locator('.todo-item:has-text("Existing todo 1")')).toHaveClass(
      /completed/
    );
    await expect(page.locator('.todo-item:has-text("Existing todo 1") input[type="checkbox"]')).toBeChecked();
  });
});
