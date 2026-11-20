
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, list } from "../api.js";
import { Alert, Badge, fmt, TYPES } from "../components/ui.jsx";
import QRModal from "../components/QRModal.jsx";
import "./NgoDashboard.css";

export default function NgoDashboard() {
  const [tab, setTab] = useState("browse");
  const [type, setType] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  const [donations, setDonations] = useState([]);
  const [pickups, setPickups] = useState([]);

  const [qr, setQr] = useState(null);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [requestingId, setRequestingId] = useState(null);

  // LOAD AVAILABLE DONATIONS
  const loadDonations = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: "available",
      });

      if (type) params.set("donation_type", type);
      if (q) params.set("search", q);

      const data = await list(`/donations/?${params}`);
      setDonations(data);
    } catch (e) {
      setErr(e.message);
    }
  }, [type, q]);

  // LOAD NGO PICKUP REQUESTS
  const loadPickups = useCallback(async () => {
    try {
      const data = await list("/pickups/");
      setPickups(data);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

  useEffect(() => {
    loadPickups();

    const interval = setInterval(() => {
      loadPickups();
      loadDonations();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadPickups, loadDonations]);

  // CHECK ALREADY REQUESTED DONATIONS
  const requested = new Set(
    pickups.map((p) => p.donation)
  );

  // REQUEST A DONATION
  async function request(donation) {
    const message = window.prompt(
      "Add a message for the donor (optional):",
      ""
    );

    if (message === null) return;

    setErr("");
    setMsg("");
    setRequestingId(donation.id);

    try {
      await api("/pickups/", {
        method: "POST",
        body: {
          donation: donation.id,
          message,
        },
      });

      setMsg(
        `Pickup requested for "${donation.title}". You can track its status under My pickups.`
      );

      await loadPickups();
      setTab("mine");
    } catch (e) {
      setErr(e.message);
    } finally {
      setRequestingId(null);
    }
  }

  // GENERATE PICKUP QR
  async function showQr(pickupId) {
    setErr("");
    setQrLoading(true);

    try {
      const data = await api(
        `/pickups/${pickupId}/qr/`,
        { method: "POST" }
      );

      if (!data.token) {
        throw new Error(
          "The server did not return a QR token."
        );
      }

      setQr({
        pickupId,
        token: data.token,
        expires_at: data.expires_at,
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setQrLoading(false);
    }
  }

  // CLOSE QR MODAL
  function closeQr() {
    setQr(null);
    loadPickups();
  }

  // STATISTICS
  const count = (status) =>
    pickups.filter((p) => p.status === status).length;

  return (
    <main className="ngo-dashboard">

      {/* WELCOME BANNER */}
      <section className="page-intro">
        <span className="donor-eyebrow">
          COMMUNITY SUPPORT NETWORK
        </span>

        <h1>Find support for your community.</h1>

        <p>
          Discover nearby contributions, coordinate collection
          and keep every pickup organised in one place.
        </p>
      </section>

      {/* DASHBOARD HEADING */}
      <div className="section-heading">
        <div>
          <h1>NGO dashboard</h1>
          <p className="muted">
            Manage requests and discover available donations.
          </p>
        </div>
      </div>

      {/* ALERTS */}
      {err && <Alert>{err}</Alert>}
      {msg && <Alert kind="success">{msg}</Alert>}

      {/* STATISTICS */}
      <section className="stats">
        <div className="stat">
          <b>{count("pending")}</b>
          Pending
        </div>

        <div className="stat">
          <b>{count("accepted")}</b>
          Accepted
        </div>

        <div className="stat">
          <b>{count("completed")}</b>
          Completed
        </div>

        <div className="stat">
          <b>{count("rejected")}</b>
          Rejected
        </div>
      </section>

      {/* TABS */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "browse" ? "active" : ""}`}
          onClick={() => setTab("browse")}
        >
          Browse donations
        </button>

        <button
          type="button"
          className={`tab ${tab === "mine" ? "active" : ""}`}
          onClick={() => setTab("mine")}
        >
          My pickups ({pickups.length})
        </button>
      </div>

      {/* BROWSE DONATIONS */}
      {tab === "browse" && (
        <section className="ngo-browse-section">

          {/* SEARCH FORM */}
          <form
            className="ngo-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qInput.trim());
            }}
          >
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>

              {Object.entries(TYPES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>

            <div className="ngo-search-row">
              <input
                placeholder="Search title, place..."
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />

              <button
                type="submit"
                className="btn ngo-search-button"
              >
                Search
              </button>
            </div>
          </form>

          {/* EMPTY STATE */}
          {donations.length === 0 && (
            <div className="ngo-empty-state">
              <span>🎁</span>
              <h3>No available donations</h3>
              <p>
                There are no donations matching your search right now.
                Please check again later.
              </p>
            </div>
          )}

          {/* DONATION CARDS */}
          <div className="grid ngo-donation-grid">
            {donations.map((d) => (
              <article
                className="card ngo-donation-card"
                key={d.id}
              >

                {d.image_url ? (
                  <img
                    className="thumb"
                    src={d.image_url}
                    alt={d.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="ngo-image-placeholder">
                    {d.donation_type === "food"
                      ? "🥗"
                      : d.donation_type === "clothes"
                      ? "👕"
                      : "🎁"}
                  </div>
                )}

                <h3>{d.title}</h3>

                <div className="row">
                  <Badge value={d.donation_type} />

                  {d.condition && (
                    <Badge value={d.condition} />
                  )}
                </div>

                <p>
                  {d.quantity} {d.quantity_unit}
                  {d.size_or_age_group
                    ? ` · ${d.size_or_age_group}`
                    : ""}
                </p>

                <div className="muted">
                  📍 {d.location}
                  <br />
                  From {d.donor_name}

                  {d.expiry && (
                    <>
                      <br />
                      Expires {fmt(d.expiry)}
                    </>
                  )}
                </div>

                {d.description && (
                  <p>{d.description}</p>
                )}

                <button
                  type="button"
                  className="btn small"
                  disabled={
                    requested.has(d.id) ||
                    requestingId === d.id
                  }
                  onClick={() => request(d)}
                >
                  {requestingId === d.id
                    ? "Requesting..."
                    : requested.has(d.id)
                    ? "Requested"
                    : "Request pickup"}
                </button>

              </article>
            ))}
          </div>
        </section>
      )}

      {/* MY PICKUPS */}
      {tab === "mine" && (
        <section className="ngo-pickups-section">

          {pickups.length === 0 && (
            <div className="ngo-empty-state">
              <span>🤝</span>
              <h3>No pickup requests yet</h3>
              <p>
                Browse available donations and request
                a pickup for your organisation.
              </p>

              <button
                type="button"
                className="btn"
                onClick={() => setTab("browse")}
              >
                Browse donations
              </button>
            </div>
          )}

          <div className="ngo-pickup-list">
            {pickups.map((p) => (
              <article
                className="card ngo-pickup-card"
                key={p.id}
              >

                <div className="ngo-pickup-info">

                  <div className="ngo-pickup-icon">
                    🎁
                  </div>

                  <div className="ngo-pickup-details">

                    <div className="row ngo-pickup-title">
                      <h3>
                        {p.donation_detail?.title || "Donation"}
                      </h3>

                      <Badge value={p.status} />
                    </div>

                    <p className="muted">
                      {p.donation_detail?.quantity}{" "}
                      {p.donation_detail?.quantity_unit}
                      {" · "}
                      {p.donation_detail?.location}
                    </p>

                    {p.contact && (
                      <p className="ngo-contact">
                        📞 {p.contact.name}:{" "}
                        {p.contact.phone || "No phone given"}
                      </p>
                    )}

                    {p.status === "pending" && (
                      <p className="muted">
                        Waiting for the donor to respond.
                      </p>
                    )}

                    {p.status === "accepted" && (
                      <p className="ngo-accepted-note">
                        ✓ Your pickup has been accepted.
                        Generate your QR code for the handover.
                      </p>
                    )}

                  </div>
                </div>

                {p.status === "accepted" && (
                  <button
                    type="button"
                    className="btn ngo-show-qr"
                    disabled={qrLoading}
                    onClick={() => showQr(p.id)}
                  >
                    {qrLoading
                      ? "Generating QR..."
                      : "▦ Show pickup QR"}
                  </button>
                )}

              </article>
            ))}
          </div>
        </section>
      )}

      {/* QR MODAL */}
      <QRModal
        open={!!qr}
        onClose={closeQr}
      >
        {qr && (
          <div className="ngo-qr-display">

            <div className="ngo-qr-code">
              <QRCodeSVG
                value={String(qr.token)}
                size={240}
                level="H"
                includeMargin
              />
            </div>

            <div className="ngo-qr-expiry">
              <span>◷</span>

              {qr.expires_at
                ? `Expires ${fmt(qr.expires_at)}`
                : "Use this QR code for the pickup handover."}
            </div>

            <button
              type="button"
              className="ngo-qr-refresh"
              disabled={qrLoading}
              onClick={() => showQr(qr.pickupId)}
            >
              {qrLoading
                ? "Generating..."
                : "↻ Generate new QR"}
            </button>

          </div>
        )}
      </QRModal>

    </main>
  );
}
