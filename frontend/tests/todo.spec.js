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
          body: JSON.stringify({ success: true, token: "fake-jwt-token" }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Invalid credentials",
          }),
        });
      }
    });

    // Mock todos API response
    await page.route("http://localhost:3001/items", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockTodos }),
      });
    });

    // Mock POST response for new todo
    await page.route("http://localhost:3001/items", async (route) => {
      const request = route.request();
      const postData = await request.postDataJSON();

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: mockTodos.length + 1,
          title: "Test todo " + (mockTodos.length + 1),
          completed: false,
        }),
      });
    });

    // Mock PUT response for updating todo
    await page.route(/http:\/\/localhost:3001\/items\/\d+/, async (route) => {
      const request = route.request();
      const postData = await request.postDataJSON();
      const todoId = parseInt(route.request().url().split("/").pop());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: todoId,
          title: "Updated todo",
          completed: postData.completed,
        }),
      });
    });

    // Mock DELETE response
    await page.route(/http:\/\/localhost:3001\/items\/\d+/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Start server and navigate
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Wait for initial render

    // Ensure login form is visible before proceeding
    await page.waitForSelector(".login-container", {
      state: "visible",
      timeout: 10000,
    });
    await page.waitForSelector(".login-form", {
      state: "visible",
      timeout: 10000,
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
    // Wait for login form to be visible
    await page.waitForSelector(".login-container", {
      state: "visible",
      timeout: 10000,
    });
    await page.waitForSelector(".login-form", {
      state: "visible",
      timeout: 10000,
    });

    // Fill login form
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Wait for login button to be disabled (loading state)
    await page.waitForSelector("button.login-button:disabled", {
      state: "visible",
    });
    // Wait for login button to be enabled again
    await page.waitForSelector("button.login-button:not(:disabled)", {
      state: "visible",
    });

    // Wait for navigation and todos to load completely
    await page.waitForURL("http://localhost:3000/");
    await page.waitForSelector(".todo-item", {
      state: "visible",
      timeout: 10000,
    });
    await page.waitForSelector(".todo-item .todo-text", {
      state: "visible",
      timeout: 10000,
    });
    await page.waitForTimeout(1000); // Wait for data to load

    // Verify successful login and data loaded
    await expect(page.locator("h1")).toHaveText("Todo App");
    await expect(page.locator(".todo-item .todo-text")).toHaveCount(
      mockTodos.length
    );
    await expect(page.locator(".todo-item .todo-text")).toContainText(
      mockTodos[0].title
    );
    await expect(page.locator(".todo-item .todo-text")).toContainText(
      mockTodos[1].title
    );
  });

  test("should show error with invalid credentials", async ({ page }) => {
    // Wait for login form to be visible
    await expect(page.locator(".login-container")).toBeVisible();

    // Fill login form with invalid credentials
    await page.fill('input[placeholder="Username"]', "wronguser");
    await page.fill('input[placeholder="Password"]', "wrongpass");
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    await page.waitForSelector(".error-message", { state: "visible" });

    // Wait for error message to appear
    await page.waitForSelector(".error-message", { state: "visible" });

    // Verify error message appears and stays on login page
    await expect(page.locator(".error-message")).toContainText(
      "Invalid credentials"
    );
    await expect(page.locator("h2")).toHaveText("Login"); // Still on login page
  });

  // 2. Delete Item
  test("should delete a todo item", async ({ page }) => {
    // Login and navigate to todos
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/");
    await page.waitForSelector(".todo-item", { state: 'visible', timeout: 10000 });

    // Mock DELETE response
    await page.route(/http:\/\/localhost:3001\/items\/\d+/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Delete first todo item
    await page.locator('.todo-item').first().locator('.todo-delete').click();

    // Verify item is removed
    await expect(page.locator('.todo-item')).toHaveCount(mockTodos.length - 1);
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

    // Click edit button and wait for edit mode
    await page.locator(".todo-item").first().locator(".todo-edit").click();
    await page.waitForSelector(".todo-item .todo-text", {
      state: "visible",
      timeout: 10000,
    });

    // Update todo text
    await page
      .locator(".todo-item")
      .first()
      .locator(".todo-text")
      .fill("Updated todo");

    // Save changes
    await page
      .locator(".todo-item")
      .first()
      .locator(".todo-edit")
      .press("Enter");

    // Wait for update to complete
    await page.waitForSelector(".todo-item .todo-text", {
      state: "visible",
      timeout: 10000,
    });

    // Wait for update to complete and verify
    await page.waitForSelector(".todo-item .todo-text", { state: "visible" });
    await expect(
      page.locator(".todo-item:first-child .todo-text")
    ).toContainText("Updated todo");
    await expect(
      page.locator(".todo-item:first-child .todo-text")
    ).not.toContainText("Existing todo 1");
  });



  test("should maintain data integrity after actions", async ({ page }) => {
    // Login and navigate to todos
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/");
    await page.waitForSelector(".todo-item", { state: 'visible', timeout: 10000 });

    // Verify initial state
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);
    await expect(page.locator(".todo-item .todo-text")).toContainText(mockTodos[0].title);
    await expect(page.locator(".todo-item .todo-text")).toContainText(mockTodos[1].title);

    // Create a new todo
    const newTodoText = "Test todo for integrity check";
    await page.fill('input[name="todoTitle"]', newTodoText);
    await page.click('button[type="submit"]');
    await page.waitForSelector(".todo-item:last-child .todo-text", {
      state: "visible",
    });
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length + 1);
    await expect(
      page.locator(".todo-item:last-child .todo-text")
    ).toContainText(newTodoText);

    // Toggle the new todo
    await page.locator('.todo-item:last-child input[type="checkbox"]').click();
    await page.waitForSelector(".todo-item:last-child .todo-text.completed", {
      state: "visible",
    });
    await expect(page.locator(".todo-item:last-child .todo-text")).toHaveClass(
      /completed/
    );

    // Edit the new todo
    await page.locator(".todo-item:last-child .todo-edit").click();
    await page
      .locator(".todo-item:last-child .todo-text")
      .fill("Updated test todo");
    await page.locator(".todo-item:last-child .todo-edit").press("Enter");
    await expect(
      page.locator(".todo-item:last-child .todo-text")
    ).toContainText("Updated test todo");

    // Delete the todo
    await page.locator(".todo-item:last-child .todo-delete").click();
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);

    // Verify todos are still intact after all actions
    await page.reload();
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);

    // Verify todos are properly displayed
    for (const todo of mockTodos) {
      const todoElement = page.locator(`.todo-item:has-text("${todo.title}")`);
      await expect(todoElement).toBeVisible();
      if (todo.completed) {
        await expect(todoElement.locator(".todo-text")).toHaveClass(
          /completed/
        );
      }
    }

    // Verify initial data
    await expect(page.locator(".todo-list li")).toHaveCount(2);
    await expect(page.locator(".todo-list li").first()).toContainText(
      "Existing todo 1"
    );
    await expect(page.locator(".todo-list li").nth(1)).toContainText(
      "Existing todo 2"
    );

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
    await expect(
      page.locator('.todo-item:has-text("Existing todo 1")')
    ).toHaveClass(/completed/);
    await expect(
      page.locator(
        '.todo-item:has-text("Existing todo 1") input[type="checkbox"]'
      )
    ).toBeChecked();
  });
});
