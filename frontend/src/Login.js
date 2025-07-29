import React, { useState, useEffect } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [showCredentials, setShowCredentials] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-focus password field when component mounts
  useEffect(() => {
    const passwordInput = document.querySelector(
      '.login-form input[type="password"]'
    );
    if (passwordInput) {
      passwordInput.focus();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      console.log("Attempting login with:", { username, password });

      const response = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: window.location.origin,
        },
        mode: "cors",
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        console.log("Login successful, token:", data.token);
        onLogin(data.token);
      } else {
        setError(data.message || "Invalid credentials");
        setShowCredentials(true);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(
        "Failed to connect to server. Please ensure the backend is running and accessible.\n\n" +
          "Troubleshooting steps:\n" +
          "1. Check if backend server is running on port 3001\n" +
          "2. Verify network connection\n" +
          "3. Try restarting both frontend and backend servers"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      {error && <div className="error-message">{error}</div>}
      <div className="login-form">
        <div
          className="credentials-info"
          style={{ display: showCredentials ? "block" : "none" }}
        >
          <p>Default credentials:</p>
          <p>Username: testuser</p>
          <p>Password: password</p>
          <button
            className="show-credentials-button"
            onClick={() => setShowCredentials(false)}
          >
            Hide credentials
          </button>
        </div>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />
          <br />
          <br />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <br />
          <br />
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
