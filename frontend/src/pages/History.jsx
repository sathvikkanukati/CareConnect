
import { useEffect, useState } from "react";
import { api } from "../api.js";

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not specified";

  return date.toLocaleString();
}

function getStatusColor(status) {
  const colors = {
    available: "#16834a",
    reserved: "#b7791f",
    completed: "#2563eb",
    cancelled: "#dc2626",
    expired: "#6b7280",
  };

  return colors[status] || "#6b7280";
}

export default function History() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await api("/donations/history/");

        setDonations(
          Array.isArray(data) ? data : data?.results ?? []
        );
      } catch (err) {
        setError(err.message || "Unable to load donation history.");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  if (loading) {
    return <p className="center muted">Loading donation history...</p>;
  }

  return (
    <section className="history-page">
      <header className="needs-heading">
        <span className="page-kicker">YOUR CONTRIBUTIONS</span>
        <h1>Donation history</h1>
      <p className="muted history-intro">
        Track what you have shared and see how each contribution moved through the handover process.
      </p>
      </header>

      {error && (
        <div className="card">
          <p style={{ color: "#dc2626" }}>{error}</p>
          <button
            className="btn"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}

      {!error && donations.length === 0 && (
        <div className="card">
          <h3>No donations yet</h3>
          <p className="muted">
            Your donation history will appear here after you donate.
          </p>
        </div>
      )}

      {!error && donations.length > 0 && (
        <>
          <p className="muted">
            Total donations: <strong>{donations.length}</strong>
          </p>

          <div className="history-list">
            {donations.map((donation) => (
              <article className="card history-card" key={donation.id}>
                <div className="history-item">
                  {donation.image_url && (
                    <img
                      src={donation.image_url}
                      alt={donation.title}
                      className="history-image"
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h2 style={{ marginTop: 0 }}>
                      {donation.title}
                    </h2>

                    <p>
                      <strong>Type:</strong>{" "}
                      {donation.donation_type}
                    </p>

                    <p>
                      <strong>Category:</strong>{" "}
                      {donation.category || "Not specified"}
                    </p>

                    <p>
                      <strong>Quantity:</strong>{" "}
                      {donation.quantity} {donation.quantity_unit}
                    </p>

                    {donation.condition && (
                      <p>
                        <strong>Condition:</strong>{" "}
                        {donation.condition}
                      </p>
                    )}

                    <p>
                      <strong>Location:</strong>{" "}
                      {donation.location}
                    </p>

                    <p>
                      <strong>Expiry:</strong>{" "}
                      {formatDate(donation.expiry)}
                    </p>

                    <p>
                      <strong>Donated on:</strong>{" "}
                      {formatDate(donation.created_at)}
                    </p>

                    <p>
                      <strong>Status:</strong>{" "}
                      <span
                        style={{
                          color: getStatusColor(donation.status),
                          fontWeight: "bold",
                          textTransform: "capitalize",
                        }}
                      >
                        {donation.status}
                      </span>
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
