import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, list } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Alert, Badge, TYPES } from "../components/ui.jsx";

export default function Needs() {
  const { user } = useAuth();
  const [needs, setNeeds] = useState([]);
  const [type, setType] = useState("");
  const [f, setF] = useState({ need_type: "clothes", title: "", description: "", quantity_needed: "", urgency: "medium" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = useCallback(async () => {
    try {
      setNeeds(await list(`/needs/${type ? `?need_type=${type}` : ""}`));
    } catch (e) {
      setErr(e.message);
    }
  }, [type]);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api("/needs/", {
        method: "POST",
        body: { ...f, quantity_needed: f.quantity_needed ? Number(f.quantity_needed) : null },
      });
      setF({ ...f, title: "", description: "", quantity_needed: "" });
      setMsg("Need posted.");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function toggle(n) {
    try {
      await api(`/needs/${n.id}/`, { method: "PATCH", body: { is_active: !n.is_active } });
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function remove(n) {
    if (!window.confirm("Delete this need?")) return;
    try {
      await api(`/needs/${n.id}/`, { method: "DELETE" });
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <main className="needs-page">
      <header className="needs-heading">
        <span className="page-kicker">COMMUNITY NEEDS</span>
        <h1>Needs board</h1>
        <p>See what local organisations need and help match useful items with people who can use them.</p>
      </header>
      <Alert>{err}</Alert>
      <Alert kind="success">{msg}</Alert>

      {user.role === "ngo" && (
        <div className="card needs-compose">
          <div className="needs-compose-heading"><span className="page-kicker">FOR ORGANISATIONS</span><h2>Post a community need</h2><p>Be specific so neighbours know what would help most.</p></div>
          <form className="stack" onSubmit={add}>
            <div className="two">
              <label>Type
                <select value={f.need_type} onChange={set("need_type")}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Urgency
                <select value={f.urgency} onChange={set("urgency")}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </label>
            </div>
            <div className="two">
              <label>What do you need?<input value={f.title} onChange={set("title")} required placeholder="e.g. Blankets for winter" /></label>
              <label>How many (optional)<input type="number" min="1" value={f.quantity_needed} onChange={set("quantity_needed")} /></label>
            </div>
            <label>Details (optional)<textarea value={f.description} onChange={set("description")} /></label>
            <button className="btn">Post need</button>
          </form>
        </div>
      )}

      <div className="row needs-filter">
        <select style={{ width: 170 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {needs.length === 0 && <div className="needs-empty"><strong>No community needs posted yet</strong><span>Check back soon for requests from local organisations.</span></div>}
      <div className="grid needs-grid">
        {needs.map((n) => (
          <article className="card needs-card" key={n.id}>
            <h3>{n.title}</h3>
            <div className="row"><Badge value={n.need_type} /><Badge value={n.urgency} />{!n.is_active && <Badge value="cancelled" />}</div>
            <p className="muted">{n.ngo_name}{n.ngo_city ? ` · ${n.ngo_city}` : ""}{n.quantity_needed ? ` · needs ${n.quantity_needed}` : ""}</p>
            {n.description && <p>{n.description}</p>}
            {user.role === "donor" && (
              <Link className="btn small" to={`/donor/donate?type=${n.need_type}&title=${encodeURIComponent(n.title)}`}>Donate this</Link>
            )}
            {user.role === "ngo" && n.ngo === user.id && (
              <div className="row">
                <button className="btn small ghost" onClick={() => toggle(n)}>{n.is_active ? "Mark fulfilled" : "Reopen"}</button>
                <button className="btn small danger" onClick={() => remove(n)}>Delete</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
