
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, list } from "../api.js";
import { Badge, fmt } from "../components/ui.jsx";
import "./DonorDashboard.css";

export default function DonorDashboard() {
  const [donations, setDonations] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, p, s] = await Promise.all([
        list("/donations/"),
        list("/pickups/"),
        api("/stats/"),
      ]);

      setDonations(d);
      setPickups(p);
      setStats(s);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function act(path, successMessage) {
    setErr("");
    setMsg("");
    setActing(path);

    try {
      await api(path, { method: "POST" });
      setMsg(successMessage);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActing(null);
    }
  }

  const byStatus = stats?.donations_by_status || {};
  const pending = pickups.filter((p) => p.status === "pending");
  const completed = byStatus.completed || 0;
  const available = byStatus.available || 0;
  const reserved = byStatus.reserved || 0;

  const totalDonations = donations.length;

  return (
    <main className="donor-dashboard">

      {/* WELCOME HEADER */}
      <section className="donor-welcome">
        <div>
          <span className="donor-eyebrow">
            YOUR COMMUNITY IMPACT
          </span>

          <h1>
            Good things start
            <br />
            with <span>sharing.</span>
          </h1>

          <p>
            Every donation makes a difference.
            Thank you for helping your community.
          </p>
        </div>

        <div className="welcome-decoration" aria-hidden="true">
          <span>🌱</span>
          <span>🥗</span>
          <span>💚</span>
        </div>
      </section>

      {/* ALERT MESSAGES */}
      {err && (
        <div className="donor-alert donor-alert-error">
          <span>!</span>
          {err}
        </div>
      )}

      {msg && (
        <div className="donor-alert donor-alert-success">
          <span>✓</span>
          {msg}
        </div>
      )}

      {/* DASHBOARD BODY */}
      <div className="donor-dashboard-layout">


        {/* RIGHT MAIN CONTENT */}
        <div className="donor-main-content">

          {/* SECTION TITLE */}
          <div className="donor-section-title">
            <div>
              <span className="donor-eyebrow">OVERVIEW</span>
              <h2>Your giving activity</h2>
              <p>Here is what's happening with your donations.</p>
            </div>

            <div className="donor-total-pill">
              <span>♡</span>
              {totalDonations} donations
            </div>
          </div>

          {/* STATISTICS */}
          <section className="donor-stats">

            <div className="donor-stat-card stat-available">
              <div className="stat-card-top">
                <span className="stat-icon">♧</span>
                <span className="stat-label">AVAILABLE</span>
              </div>
              <strong>{available}</strong>
              <p>Waiting for someone</p>
            </div>

            <div className="donor-stat-card stat-reserved">
              <div className="stat-card-top">
                <span className="stat-icon">⌛</span>
                <span className="stat-label">RESERVED</span>
              </div>
              <strong>{reserved}</strong>
              <p>Pickup in progress</p>
            </div>

            <div className="donor-stat-card stat-completed">
              <div className="stat-card-top">
                <span className="stat-icon">✓</span>
                <span className="stat-label">COMPLETED</span>
              </div>
              <strong>{completed}</strong>
              <p>Successfully handed over</p>
            </div>

            <div className="donor-stat-card stat-pending">
              <div className="stat-card-top">
                <span className="stat-icon">♧</span>
                <span className="stat-label">REQUESTS</span>
              </div>
              <strong>{pending.length}</strong>
              <p>Waiting for your response</p>
            </div>

          </section>

          {/* MY DONATIONS */}
          <section className="donor-content-section">

            <div className="donor-section-title compact-title">
              <div>
                <span className="donor-eyebrow">YOUR CONTRIBUTIONS</span>
                <h2>My donations</h2>
                <p>Everything you have shared with the community.</p>
              </div>

              <Link to="/donor/donate" className="donor-text-link">
                + Add donation
              </Link>
            </div>

            {loading && (
              <div className="donor-empty">
                <span className="empty-icon">⌛</span>
                <h3>Loading donations...</h3>
              </div>
            )}

            {!loading && donations.length === 0 && (
              <div className="donor-empty">
                <span className="empty-icon">🎁</span>
                <h3>Your donation journey starts here</h3>
                <p>
                  You haven't donated anything yet.
                  Share your first resource with someone in need.
                </p>
                <Link to="/donor/donate" className="donor-empty-button">
                  Create your first donation →
                </Link>
              </div>
            )}

            <div className="donor-donation-grid">

              {donations.map((d) => (
                <article className="donation-card" key={d.id}>

                  <div className="donation-image-wrap">

                    {d.image_url ? (
                      <img
                        className="donation-image"
                        src={d.image_url}
                        alt={d.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="donation-image-placeholder">
                        {d.donation_type === "food"
                          ? "🥗"
                          : d.donation_type === "clothes"
                          ? "👕"
                          : "🎁"}
                      </div>
                    )}

                    <div className="donation-image-badge">
                      {d.donation_type || "Donation"}
                    </div>

                  </div>

                  <div className="donation-card-body">

                    <div className="donation-card-heading">
                      <h3>{d.title}</h3>
                      <Badge value={d.status} />
                    </div>

                    {d.category && (
                      <p className="donation-category">
                        {d.category}
                      </p>
                    )}

                    <div className="donation-meta">
                      <div>
                        <span>QUANTITY</span>
                        <strong>
                          {d.quantity} {d.quantity_unit}
                        </strong>
                      </div>

                      <div>
                        <span>LOCATION</span>
                        <strong>{d.location || "Not specified"}</strong>
                      </div>
                    </div>

                    {d.expiry && (
                      <div className="donation-expiry">
                        <span>◷</span>
                        Expires {fmt(d.expiry)}
                      </div>
                    )}

                    {(d.status === "available" || d.status === "reserved") && (
                      <button
                        type="button"
                        className="donation-cancel"
                        disabled={!!acting}
                        onClick={() =>
                          window.confirm("Cancel this donation?") &&
                          act(
                            `/donations/${d.id}/cancel/`,
                            "Donation cancelled."
                          )
                        }
                      >
                        {acting === `/donations/${d.id}/cancel/`
                          ? "Cancelling..."
                          : "Cancel donation"}
                      </button>
                    )}

                  </div>

                </article>
              ))}

            </div>

          </section>

          {/* PICKUP REQUESTS */}
          <section className="donor-content-section">

            <div className="donor-section-title compact-title">
              <div>
                <span className="donor-eyebrow">HANDOVER ACTIVITY</span>
                <h2>Pickup requests</h2>
                <p>Manage requests from NGOs.</p>
              </div>

              <span className="donor-count">
                {pickups.length} total
              </span>
            </div>

            {loading && (
              <div className="donor-empty">
                <span className="empty-icon">⌛</span>
                <h3>Loading requests...</h3>
                <p>Getting your latest donation activity.</p>
              </div>
            )}

            {!loading && pickups.length === 0 && (
              <div className="donor-empty">
                <span className="empty-icon">🤝</span>
                <h3>No pickup requests yet</h3>
                <p>
                  When an NGO requests one of your donations,
                  it will appear here.
                </p>
              </div>
            )}

            <div className="pickup-list">
              {pickups.map((p) => (
                <article className="pickup-card" key={p.id}>

                  <div className="pickup-card-main">

                    <div className="pickup-avatar">
                      🏢
                    </div>

                    <div className="pickup-details">
                      <div className="pickup-title-row">
                        <h3>
                          {p.donation_detail?.title || "Donation request"}
                        </h3>
                        <Badge value={p.status} />
                      </div>

                      <p className="pickup-requester">
                        Requested by <strong>{p.ngo_name || "NGO"}</strong>
                      </p>

                      <p className="pickup-date">
                        {fmt(p.created_at)}
                      </p>

                      {p.message && (
                        <div className="pickup-message">
                          “{p.message}”
                        </div>
                      )}

                      {p.contact && (
                        <p className="pickup-contact">
                          📞 {p.contact.name}: {p.contact.phone || "No phone given"}
                        </p>
                      )}

                      {p.status === "accepted" && (
                        <div className="pickup-instruction">
                          <span>✓</span>
                          When the NGO arrives, scan their QR code
                          to complete the handover.
                        </div>
                      )}
                    </div>

                  </div>

                  {p.status === "pending" && (
                    <div className="pickup-actions">

                      <button
                        type="button"
                        className="pickup-accept"
                        disabled={!!acting}
                        onClick={() =>
                          act(
                            `/pickups/${p.id}/accept/`,
                            "Request accepted."
                          )
                        }
                      >
                        {acting === `/pickups/${p.id}/accept/`
                          ? "Accepting..."
                          : "✓ Accept"}
                      </button>

                      <button
                        type="button"
                        className="pickup-reject"
                        disabled={!!acting}
                        onClick={() =>
                          act(
                            `/pickups/${p.id}/reject/`,
                            "Request rejected."
                          )
                        }
                      >
                        {acting === `/pickups/${p.id}/reject/`
                          ? "Rejecting..."
                          : "Reject"}
                      </button>

                    </div>
                  )}

                </article>
              ))}
            </div>

          </section>


        </div>
      </div>

    </main>
  );
}
