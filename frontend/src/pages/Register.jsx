import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Alert } from "../components/ui.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", role: "donor", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await register({ ...form, email: form.email.trim(), name: form.name.trim() });
      navigate("/");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth">
      <h1>Join the community</h1>
      <p className="muted">Create an account and help good resources reach the right people.</p>
      <Alert>{err}</Alert>
      <form className="stack" onSubmit={submit}>
        <label>I am a
          <select value={form.role} onChange={set("role")}>
            <option value="donor">Donor (restaurant, household, shop…)</option>
            <option value="ngo">NGO / receiver</option>
          </select>
        </label>
        <label>Name<input value={form.name} onChange={set("name")} required /></label>
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
        <div className="two">
          <label>Phone<input value={form.phone} onChange={set("phone")} /></label>
          <label>City<input value={form.city} onChange={set("city")} /></label>
        </div>
        <label>Password (min 8 characters)<input type="password" minLength={8} value={form.password} onChange={set("password")} required /></label>
        <button className="btn" disabled={busy}>{busy ? "Creating…" : "Register"}</button>
      </form>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}
