
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import DonorDashboard from "./pages/DonorDashboard.jsx";
import DonateForm from "./pages/DonateForm.jsx";
import Scan from "./pages/Scan.jsx";
import NgoDashboard from "./pages/NgoDashboard.jsx";
import Needs from "./pages/Needs.jsx";
import History from "./pages/History.jsx";

function Home() {
  const { user, loading } = useAuth();

  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "donor") return <Navigate to="/donor" replace />;
  if (user.role === "ngo") return <Navigate to="/ngo" replace />;

  return (
    <div className="card">
      <h1>Admin account</h1>
      <p>
        Admins manage data in the Django admin:{" "}
        <a href="http://127.0.0.1:8000/admin/">
          http://127.0.0.1:8000/admin/
        </a>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/donor"
          element={
            <ProtectedRoute roles={["donor"]}>
              <DonorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/donor/donate"
          element={
            <ProtectedRoute roles={["donor"]}>
              <DonateForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/donor/scan"
          element={
            <ProtectedRoute roles={["donor"]}>
              <Scan />
            </ProtectedRoute>
          }
        />

        <Route
          path="/donor/history"
          element={
            <ProtectedRoute roles={["donor"]}>
              <History />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ngo"
          element={
            <ProtectedRoute roles={["ngo"]}>
              <NgoDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/needs"
          element={
            <ProtectedRoute roles={["donor", "ngo"]}>
              <Needs />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
