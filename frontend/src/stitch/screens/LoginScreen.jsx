import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginScreen({ mode = "login", loading = false, error = "", onSubmit }) {
  const navigate = useNavigate();
  const isSignup = useMemo(() => mode === "register", [mode]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) {
      return;
    }

    const payload = isSignup
      ? form
      : {
          email: form.email,
          password: form.password
        };

    await onSubmit(payload);
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">

        {/* LEFT SIDE */}
        <div className="hero-copy">
          <h1>
            Instant <span className="hero-highlight">Payments</span>
          </h1>
          <p>No fees. No delays. Just speed.</p>
        </div>

        {/* RIGHT SIDE FORM */}
        <div className="card auth-card glass-card login-surface">
          <h2>{isSignup ? "Create Account" : "Welcome Back"}</h2>

          <form onSubmit={handleSubmit} noValidate>

            {/* NAME (ONLY FOR SIGNUP) */}
            {isSignup && (
              <input
                type="text"
                name="name"
                placeholder="Name"
                value={form.name}
                onChange={handleChange}
                required
              />
            )}

            {/* EMAIL */}
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />

            {/* PASSWORD */}
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />

            {/* ERROR */}
            {error && <p className="error">{error}</p>}

            {/* BUTTON */}
            <button
              type="submit"
              className="primary-button auth-cta"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isSignup
                ? "Sign Up"
                : "Login"}
            </button>
          </form>

          {/* SWITCH */}
          <p className="switch-copy">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <span
              style={{ color: "#54c3ff", cursor: "pointer" }}
              onClick={() => {
                navigate(isSignup ? "/login" : "/register");
              }}
            >
              {isSignup ? "Login" : "Sign up"}
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}
