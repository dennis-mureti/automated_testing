import { test, expect } from "@playwright/test";

test.describe("Todo App Frontend Tests", () => {
  // Mock data
  const mockTodos = [
    { id: 1, title: "Existing todo 1", completed: false },
    { id: 2, title: "Existing todo 2", completed: true },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock login API
    await page.route("http://localhost:3001/login", async (route) => {
      console.log("Login API route hit");
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

    // Mock items API with method-specific handling
    await page.route("http://localhost:3001/items", async (route) => {
      console.log("Todos API route hit");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { data: mockTodos } }),
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

    // Mock DELETE response for deleting todo
    await page.route(/http:\/\/localhost:3001\/items\/\d+/, async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Navigate to the app
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Wait for login form to be visible
    await page.waitForSelector(".login-container", {
      state: "visible",
      timeout: 10000,
    });
  });

  // 1. Login Tests
  test("should login with valid credentials", async ({ page }) => {
    // Fill login form
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Wait for login to complete and navigation
    await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

    // Wait for todos to load
    await page.waitForSelector(".todo-item", {
      state: "visible",
      timeout: 15000,
    });

    // Verify successful login and data loaded
    await expect(page.locator("h1")).toHaveText("Todo App");
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);

    // Check individual todo items
    for (const todo of mockTodos) {
      await expect(page.locator(".todo-item")).toContainText(todo.title);
    }
  });

  test("should show error with invalid credentials", async ({ page }) => {
    // Fill login form with invalid credentials
    await page.fill('input[placeholder="Username"]', "wronguser");
    await page.fill('input[placeholder="Password"]', "wrongpass");
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    await page.waitForSelector(".error-message", {
      state: "visible",
      timeout: 10000,
    });

    // Verify error message appears and stays on login page
    await expect(page.locator(".error-message")).toContainText(
      "Invalid credentials"
    );
    await expect(page.locator("h2")).toHaveText("Login");
  });

  // Helper function to login
  async function loginUser(page) {
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/", { timeout: 10000 });
    await page.waitForSelector(".todo-item", {
      state: "visible",
      timeout: 15000,
    });
  }

  // 2. Delete Item
  test("should delete a todo item", async ({ page }) => {
    await loginUser(page);

    const initialCount = await page.locator(".todo-item").count();

    // Delete first todo item
    await page.locator(".todo-item").first().locator(".todo-delete").click();

    // Wait for item to be removed from UI
    await page.waitForSelector('.todo-item', { state: 'detached' });
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length - 1);
  });

  // 3. Edit Existing Item
  test("should edit an existing todo item", async ({ page }) => {
    await loginUser(page);

    // Click edit button on first item
    await page.locator(".todo-item").first().locator(".todo-edit").click();

    // Wait for edit mode (input field should appear)
    await page.waitForSelector(
      ".todo-item input[type='text'], .todo-item .todo-text",
      {
        state: "visible",
        timeout: 5000,
      }
    );

    // Update todo text (adjust selector based on your implementation)
    const editInput = page
      .locator(".todo-item")
      .first()
      .locator("input[type='text'], .todo-text");
    await editInput.fill("Updated todo");

    // Save changes (could be Enter key or save button)
    await editInput.press("Enter");

    // Wait for update to complete
    await page.waitForTimeout(1000);

    // Verify the text was updated
    await expect(page.locator(".todo-item").first()).toContainText(
      "Updated todo"
    );
    await expect(page.locator(".todo-item").first()).not.toContainText(
      "Existing todo 1"
    );
  });

  // 4. Add New Todo
  test("should add a new todo item", async ({ page }) => {
    await loginUser(page);

    const initialCount = await page.locator(".todo-item").count();
    const newTodoText = "New test todo";

    // Add new todo
    await page.fill(
      'input[name="todoTitle"], input[placeholder*="todo"], .todo-input',
      newTodoText
    );
    await page.click('button[type="submit"], .add-todo-button');

    // Wait for new item to appear
    await expect(page.locator(".todo-item")).toHaveCount(initialCount + 1);
    await expect(page.locator(".todo-item")).toContainText(newTodoText);
  });

  // 5. Toggle Todo Completion
  test("should toggle todo completion status", async ({ page }) => {
    await loginUser(page);

    const firstTodo = page.locator(".todo-item").first();
    const checkbox = firstTodo.locator('input[type="checkbox"]');

    // Get initial state
    const wasChecked = await checkbox.isChecked();

    // Toggle checkbox
    await checkbox.click();

    // Wait for state change
    await page.waitForTimeout(500);

    // Verify state changed
    if (wasChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }
  });

  // 6. Data Integrity Test
  test("should maintain data integrity after multiple actions", async ({
    page,
  }) => {
    await loginUser(page);

    // Verify initial state
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);

    // Add a new todo
    const newTodoText = "Integrity test todo";
    await page.fill(
      'input[name="todoTitle"], input[placeholder*="todo"], .todo-input',
      newTodoText
    );
    await page.click('button[type="submit"], .add-todo-button');

    // Wait for new item
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length + 1);
    await expect(page.locator(".todo-item")).toContainText(newTodoText);

    // Toggle the new todo
    const newTodoItem = page.locator(".todo-item").last();
    await newTodoItem.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);

    // Edit the new todo
    await newTodoItem.locator(".todo-edit").click();
    const editInput = newTodoItem.locator("input[type='text'], .todo-text");
    await editInput.fill("Updated integrity test todo");
    await editInput.press("Enter");
    await page.waitForTimeout(1000);

    // Verify edit worked
    await expect(newTodoItem).toContainText("Updated integrity test todo");

    // Delete the todo
    await newTodoItem.locator(".todo-delete").click();
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length);

    // Verify original todos are still intact
    for (const todo of mockTodos) {
      await expect(page.locator(".todo-item")).toContainText(todo.title);
    }
  });
});
