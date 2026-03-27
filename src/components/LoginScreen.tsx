import { useState, type KeyboardEvent } from "react";

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("jee_auth", "1");
        onSuccess();
      } else {
        setError("Incorrect password. Try again.");
        setPassword("");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-icon">🎯</div>
        <h1 className="login-title">JEE Tutor</h1>
        <p className="login-subtitle">Enter your password to continue</p>

        <div className="login-field">
          <input
            className={`login-input ${error ? "login-input-error" : ""}`}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
        </div>

        <button
          className="login-btn"
          onClick={handleSubmit}
          disabled={!password.trim() || loading}
        >
          {loading ? <span className="login-spinner" /> : "Enter"}
        </button>
      </div>
    </div>
  );
}
