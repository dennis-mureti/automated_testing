import React, { useState, useEffect } from "react";
import "./App.css";
import Login from "./Login";
import {
  assertTodoExists,
  assertTodoCompleted,
  assertTodoDeleted,
  assertTodoUpdated,
} from "./utils/assertions";

function App() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [editIndex, setEditIndex] = useState(null);

  // Initialize input value when editing
  useEffect(() => {
    if (editIndex !== null && todos[editIndex]) {
      setInputValue(todos[editIndex].title);
    } else {
      setInputValue("");
    }
  }, [editIndex, todos]);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [assertion, setAssertion] = useState(null);

  // Fetch todos from API
  const fetchTodos = async () => {
    try {
      const response = await fetch("http://localhost:3001/items", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTodos(data.data || []); // Use data.data to match backend response structure
      setAssertion(null);
    } catch (err) {
      console.error("Error fetching todos:", err);
      setError("Failed to fetch todos");
      setTodos([]);
    }
  };

  // Handle login
  const handleLogin = (newToken) => {
    setToken(newToken);
    fetchTodos();
  };

  // Handle logout
  const handleLogout = () => {
    setToken("");
    setTodos([]);
    setInputValue("");
    setEditIndex(null);
  };

  // Handle add/edit todo with assertion
  const handleAddTodo = async () => {
    if (!inputValue.trim()) return;

    try {
      const todoData = { title: inputValue, completed: false };

      if (editIndex !== null) {
        // Update existing todo
        const todoId = todos[editIndex].id;
        const response = await fetch(`http://localhost:3001/items/${todoId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(todoData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const updatedTodo = await response.json();
        setTodos(
          todos.map((todo) => (todo.id === todoId ? updatedTodo : todo))
        );
        setAssertion(
          assertTodoUpdated(todos, todos[editIndex].title, inputValue)
        );
      } else {
        // Create new todo
        const response = await fetch("http://localhost:3001/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(todoData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const newTodo = await response.json();
        setTodos([...todos, newTodo]);
        setAssertion(assertTodoExists(todos, inputValue));
      }

      setInputValue("");
      setEditIndex(null);
      await fetchTodos();
    } catch (err) {
      console.error("Error in handleAddTodo:", err);
      setError("Failed to save in todo: " + err.message);
    }
  };

  // Handle delete todo with assertion
  const handleDeleteTodo = async (todoId) => {
    try {
      const response = await fetch(`http://localhost:3001/items/${todoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setTodos(todos.filter((todo) => todo.id !== todoId));
      await fetchTodos();
      setAssertion(
        assertTodoDeleted(todos, todos.find((t) => t.id === todoId).title)
      );
    } catch (err) {
      console.error("Error in handleDeleteTodo:", err);
      setError("Failed to delete todo: " + err.message);
    }
  };

  // Handle toggle todo with assertion
  const handleToggleTodo = async (todoId) => {
    try {
      const todo = todos.find((t) => t.id === todoId);
      await fetch(`http://localhost:3001/items/${todoId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: todo.title, completed: !todo.completed }),
      });
      await fetchTodos();
      setAssertion(
        todo.completed
          ? assertTodoCompleted(todos, todo.title)
          : assertTodoExists(todos, todo.title)
      );
    } catch (err) {
      setError("Failed to update todo status");
    }
  };

  // Handle edit todo
  const handleEditTodo = (todo) => {
    setEditIndex(todos.findIndex((t) => t.id === todo.id));
  };

  // Add assertion display component
  const AssertionMessage = () => {
    if (!assertion) return null;
    return (
      <div
        className={`assertion-message ${
          assertion ? "assertion-error" : "assertion-success"
        }`}
      >
        {assertion}
      </div>
    );
  };

  // Fetch todos when token changes
  useEffect(() => {
    if (token) {
      fetchTodos();
    }
  }, [token]);

  // Show login if not authenticated
  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Todo App</h1>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {error && <div key="error-message" className="error-message">{error}</div>}
      <AssertionMessage />

      <div className="todo-container">
        <div className="todo-input-container">
          <input
            type="text"
            placeholder={
              editIndex !== null ? "Edit task..." : "Add a new task..."
            }
            className="todo-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button className="todo-button" onClick={handleAddTodo}>
            {editIndex !== null ? "Save" : "Add"}
          </button>
        </div>
        <div className="todo-list">
          {Array.isArray(todos) && todos.length > 0 ? (
            todos.map((todo) => (
              <div key={`todo-item-${todo.id}`} className="todo-item">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo.id)}
                />
                <span
                  className={`todo-text ${todo.completed ? "completed" : ""}`}
                >
                  {todo.title}
                </span>
                <div className="todo-actions">
                  <button
                    className="todo-edit"
                    onClick={() => handleEditTodo(todo)}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    className="todo-delete"
                    onClick={() => handleDeleteTodo(todo.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-todos">No todos yet. Add one above!</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
