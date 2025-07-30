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

    // Consolidated todos API route handler
    await page.route(/http:\/\/localhost:3001\/items(\/\d+)?/, async (route) => {
      const request = route.request();
      const method = request.method();
      const url = request.url();
      const isDetailRoute = url.includes('/items/') && !url.endsWith('/items');

      try {
        if (method === "GET") {
          // GET all todos
          if (!isDetailRoute) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: { data: mockTodos } }),
            });
          } else {
            // GET single todo
            const todoId = parseInt(url.split('/').pop());
            const todo = mockTodos.find(t => t.id === todoId);
            if (todo) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(todo),
              });
            } else {
              await route.fulfill({
                status: 404,
                contentType: "application/json",
                body: JSON.stringify({ error: "Todo not found" }),
              });
            }
          }
        } else if (method === "POST") {
          const postData = await request.postDataJSON();
          const newTodo = {
            id: mockTodos.length + 1,
            title: postData.title,
            completed: false,
          };
          mockTodos.push(newTodo);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(newTodo),
          });
        } else if (method === "PUT") {
          const postData = await request.postDataJSON();
          const todoId = parseInt(url.split('/').pop());
          const todoIndex = mockTodos.findIndex(t => t.id === todoId);
          if (todoIndex !== -1) {
            mockTodos[todoIndex] = {
              ...mockTodos[todoIndex],
              ...postData,
            };
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockTodos[todoIndex]),
            });
          } else {
            await route.fulfill({
              status: 404,
              contentType: "application/json",
              body: JSON.stringify({ error: "Todo not found" }),
            });
          }
        } else if (method === "DELETE") {
          const todoId = parseInt(url.split('/').pop());
          const todoIndex = mockTodos.findIndex(t => t.id === todoId);
          if (todoIndex !== -1) {
            mockTodos.splice(todoIndex, 1);
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ success: true }),
            });
          } else {
            await route.fulfill({
              status: 404,
              contentType: "application/json",
              body: JSON.stringify({ error: "Todo not found" }),
            });
          }
        }
      } catch (error) {
        console.error('API route error:', error);
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      }
    });

    // Navigate to the app
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Wait for login form to be visible
    await page.locator(".login-container").waitFor({
      state: "visible",
      timeout: 10000,
    });
  });

  // 1. Login Tests
  test("should login with valid credentials", async ({ page }) => {
    // Login and verify successful navigation
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Wait for navigation and app to load
    await page.waitForURL("http://localhost:3000/");
    await page.waitFor.locator(".app", { state: "visible" });

    // Verify logout button is present (indicating successful login)
    await expect(page.locator(".logout-button")).toBeVisible();

    // Wait for todos to load
    await page.locator(".todo-item").waitFor({
      state: "visible",
      timeout: 30000,
    });

    // Verify todos are loaded correctly
    await expect(page.locator(".todo-item .todo-text")).toContainText(
      mockTodos[0].title
    );
    await expect(page.locator(".todo-item .todo-text")).toContainText(
      mockTodos[1].title
    );
  });

  test("should show error with invalid credentials", async ({ page }) => {
    // Fill login form with invalid credentials
    await page.fill('input[placeholder="Username"]', "wronguser");
    await page.fill('input[placeholder="Password"]', "wrongpass");
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    await page.locator(".error-message").waitFor({
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
    // Login and verify successful navigation
    await page.fill('input[placeholder="Username"]', "testuser");
    await page.fill('input[placeholder="Password"]', "password");
    await page.click('button[type="submit"]');

    // Wait for navigation and app to load with increased timeout
    await page.waitForURL("http://localhost:3000/", { timeout: 15000 });
    await page.locator(".app").waitFor({ state: "visible", timeout: 10000 });

    // Verify logout button is present (indicating successful login)
    await expect(page.locator(".logout-button")).toBeVisible();

    // Wait for todos to load with reasonable timeout
    await page.locator(".todo-item").waitFor({
      state: "visible",
      timeout: 10000,
    });

    // Verify todos are loaded correctly
    await expect(page.locator(".todo-item .todo-text")).toContainText(
      mockTodos[0].title
    );
    await expect(page.locator(".todo-item .todo-text")).toContainText(
      mockTodos[1].title
    );
  }

  // 2. Delete Item
  test("should delete a todo item", async ({ page }) => {
    await loginUser(page);

    // Get initial todo count
    const initialTodos = await page.locator(".todo-item").count();
    const initialCount = await page.locator(".todo-item").count();

    // Delete first todo item
    await page.locator(".todo-item").first().locator(".todo-delete").click();

    // Wait for item to be removed from UI
    await page.locator(".todo-item").waitFor({ state: "detached" });
    await expect(page.locator(".todo-item")).toHaveCount(mockTodos.length - 1);
  });

  // 3. Edit Existing Item
  test("should edit an existing todo item", async ({ page }) => {
    await loginUser(page);

    // Click edit button on first item
    await page.locator(".todo-item").first().locator(".todo-edit").click();

    // Wait for edit mode (input field should appear)
    await page.locator(".todo-item input[type='text'], .todo-item .todo-text", {
      state: "visible",
      timeout: 5000,
    });

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

    // Wait for state change with proper polling
    await page.waitForTimeout(1000);

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
