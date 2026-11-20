import { useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api.js";
import { Alert } from "../components/ui.jsx";

export default function Scan() {
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function verify(value) {
    setErr(""); setOk("");
    try {
      const res = await api("/pickups/verify-qr/", { method: "POST", body: { token: value.trim() } });
      setOk(`Handover confirmed for “${res.donation_detail.title}”. Thank you for donating!`);
      setToken("");
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    if (!scanning) return;
    const scanner = new Html5Qrcode("qr-reader");
    let done = false;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (text) => {
          if (done) return;
          done = true;
          scanner.stop().catch(() => {}).finally(() => { setScanning(false); verify(text); });
        },
        () => {}
      )
      .catch((e) => {
        done = true;
        setErr("Could not start the camera: " + (e?.message || e) + ". You can paste the code below instead.");
        setScanning(false);
      });
    return () => {
      if (!done) {
        done = true;
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
  }, [scanning]);

  return (
    <main className="workflow-page scan-workflow">
      <header className="workflow-heading">
        <span className="page-kicker">SAFE HANDOVER</span>
        <h1>Confirm pickup</h1>
        <p>Scan the NGO pickup code to confirm that the donation reached its destination.</p>
      </header>
      <section className="card workflow-card scan-card">
      <Alert>{err}</Alert>
      <Alert kind="success">{ok}</Alert>
      {scanning ? <div id="qr-reader" /> : <button className="btn" onClick={() => { setErr(""); setOk(""); setScanning(true); }}>📷 Scan with camera</button>}
      {scanning && <button className="btn ghost small" onClick={() => setScanning(false)}>Stop camera</button>}
      <hr style={{ margin: "20px 0", border: 0, borderTop: "1px solid #dfe7e2" }} />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(token); }}>
        <label style={{ textAlign: "left" }}>Or paste the code
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Code from the NGO’s QR" />
        </label>
        <button className="btn" disabled={!token.trim()}>Confirm handover</button>
      </form>
      </section>
    </main>
  );
}
