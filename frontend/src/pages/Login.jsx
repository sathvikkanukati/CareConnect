
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);

    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">

      {/* Background decorations */}
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />

      {/* Main login layout */}
      <section className="login-layout">

        {/* LEFT SIDE */}
        <div className="login-hero">

          <div className="hero-pill">
            <span className="hero-dot" />
            GOOD FOOD. BETTER TOMORROW.
          </div>

          <div className="hero-message">
            <span className="hero-accent">SHAREBITE COMMUNITY</span>

            <h1>
              Making
              <br />
              sharing
              <br />
              <span>matter.</span>
            </h1>

            <p className="hero-description">
              Connect surplus food with people who need it.
              Every small act of sharing creates a better
              community and a healthier planet.
            </p>
          </div>

          {/* Food illustrations */}
          <div className="food-illustration">
            <div className="food-orbit orbit-one" />
            <div className="food-orbit orbit-two" />

            <div className="food-circle">
              <span>🥗</span>
            </div>

            <span className="floating-food food-one">🍎</span>
            <span className="floating-food food-two">🥕</span>
            <span className="floating-food food-three">🍞</span>
            <span className="floating-food food-four">🥑</span>
          </div>

          {/* Impact messages */}
          <div className="hero-bottom">
            <div className="hero-stat">
              <strong>Share</strong>
              <span>what you can</span>
            </div>

            <div className="stat-divider" />

            <div className="hero-stat">
              <strong>Support</strong>
              <span>those in need</span>
            </div>

            <div className="stat-divider" />

            <div className="hero-stat">
              <strong>Sustain</strong>
              <span>our planet</span>
            </div>
          </div>

        </div>

        {/* RIGHT SIDE - LOGIN FORM */}
        <div className="login-form-side">

          <div className="login-card">

            <div className="login-card-icon">
              👋
            </div>

            <div className="login-heading">
              <span className="welcome-label">
                WELCOME BACK
              </span>

              <h2>Good to see you!</h2>

              <p>
                Sign in and continue making a difference.
              </p>
            </div>

            {/* Error message */}
            {err && (
              <div className="login-error">
                <span>!</span>
                <div>{err}</div>
              </div>
            )}

            {/* Login form */}
            <form onSubmit={submit} className="login-form">

              <label htmlFor="login-email">
                Email address
              </label>

              <div className="login-input-wrap">
                <span className="input-icon">✉</span>

                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <label htmlFor="login-password">
                Password
              </label>

              <div className="login-input-wrap">
                <span className="input-icon">♙</span>

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <button
                className="login-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="login-spinner" />
                    Signing you in...
                  </>
                ) : (
                  <>
                    Sign in to ShareBite
                    <span>→</span>
                  </>
                )}
              </button>

            </form>

            <div className="login-register">
              New to ShareBite?
              <Link to="/register">
                Create an account
              </Link>
            </div>

            <div className="login-secure">
              <span>🔒</span>
              Your account is protected with secure authentication.
            </div>

          </div>
        </div>

      </section>

      {/* Footer */}
      <footer className="login-footer">
        <span>© 2026 ShareBite</span>
        <span>Made with care for a better community 🌿</span>
      </footer>

    </main>
  );
}
