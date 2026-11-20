
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import "./Layout.css";

const LINKS = {
  donor: [
    {
      to: "/donor",
      label: "Dashboard",
      icon: "▦",
      end: true,
    },
    {
      to: "/donor/donate",
      label: "Donate",
      icon: "+",
    },
    {
      to: "/donor/scan",
      label: "Scan QR",
      icon: "▣",
    },
    {
      to: "/donor/history",
      label: "History",
      icon: "◷",
    },
    {
      to: "/needs",
      label: "NGO needs",
      icon: "♡",
    },
  ],

  ngo: [
    {
      to: "/ngo",
      label: "Dashboard",
      icon: "▦",
      end: true,
    },
    {
      to: "/needs",
      label: "Needs board",
      icon: "♡",
    },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = LINKS[user?.role] || [];

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className={`app-shell ${user ? "" : "app-shell-public"}`}>

      {/* LEFT SIDEBAR */}
      <aside className="app-sidebar">

        {/* BRAND */}
        <NavLink to="/" className="sidebar-brand">
          <span className="sidebar-brand-icon">🌱</span>

          <span className="sidebar-brand-text">
            <strong>ShareBite</strong>
            <small>COMMUNITY NETWORK</small>
          </span>
        </NavLink>

        {/* ROLE */}
        <div className="sidebar-role">
          <span className="sidebar-role-dot" />
          {!user ? "COMMUNITY NETWORK" : user.role === "donor" ? "DONOR WORKSPACE" : "NGO WORKSPACE"}
        </div>

        {/* NAVIGATION */}
        <nav className="sidebar-navigation">

          {links.length > 0 && (
            <span className="sidebar-section-label">WORKSPACE</span>
          )}

          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end || false}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-link-icon">
                {item.icon}
              </span>

              <span className="sidebar-link-label">
                {item.label}
              </span>

              <span className="sidebar-link-arrow">
                →
              </span>
            </NavLink>
          ))}

        </nav>

        {/* SIDEBAR BOTTOM */}
        <div className="sidebar-bottom">

          <div className="sidebar-message">
            <span>💚</span>
            <strong>{user ? "Give surplus a purpose." : "Good food belongs on a plate."}</strong>
            <p>
              {user
                ? "Small acts of kindness can create a big impact."
                : "Share fresh food with neighbours and local organisations."}
            </p>
            {!user && (
              <NavLink className="sidebar-guest-link" to="/register">
                Join the community <span aria-hidden="true">→</span>
              </NavLink>
            )}
          </div>
          {user && (
            <div className="sidebar-user">

              <div className="sidebar-avatar">
                {(user.name || user.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="sidebar-user-info">
                <strong>
                  {user.name || user.email || "User"}
                </strong>
                <span>
                  {user.role}
                </span>
              </div>

            </div>
          )}

          {user && (
            <button
              type="button"
              className="sidebar-logout"
              onClick={handleLogout}
            >
              <span>↪</span>
              Log out
            </button>
          )}

        </div>

      </aside>

      {/* RIGHT CONTENT AREA */}
      <div className="app-main">

        {/* MOBILE HEADER */}
        <header className="mobile-header">
          <NavLink to="/" className="mobile-brand">
            🌱 ShareBite
          </NavLink>

          <span className="mobile-user">
            {user?.name || user?.email || "User"}
          </span>
        </header>

        {/* PAGE CONTENT */}
        <main className="app-content">
          <Outlet />

          <footer className="app-footer">
            <span>
              <strong>ShareBite</strong>
              {" "}· Give surplus a purpose.
            </span>

            <span>
              Food · Clothing · Essentials · Community
            </span>
          </footer>
        </main>

      </div>

    </div>
  );
}
