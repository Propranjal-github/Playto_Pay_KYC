import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import MerchantKYC from "./pages/MerchantKYC";
import MerchantDashboard from "./pages/MerchantDashboard";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import SubmissionDetail from "./pages/SubmissionDetail";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) { try { setUser(JSON.parse(stored)); } catch { localStorage.clear(); } }
    setLoading(false);
  }, []);

  const handleLogin = (u) => { setUser(u); localStorage.setItem("user", JSON.stringify(u)); };
  const handleLogout = () => { setUser(null); localStorage.removeItem("token"); localStorage.removeItem("user"); };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <BrowserRouter>
      {user && <Navbar user={user} onLogout={handleLogout} />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === "reviewer" ? "/reviewer" : "/dashboard"} /> : <Login onLogin={handleLogin} />} />
        <Route path="/dashboard" element={user?.role === "merchant" ? <MerchantDashboard /> : <Navigate to="/login" />} />
        <Route path="/kyc/:id?" element={user?.role === "merchant" ? <MerchantKYC /> : <Navigate to="/login" />} />
        <Route path="/reviewer" element={user?.role === "reviewer" ? <ReviewerDashboard /> : <Navigate to="/login" />} />
        <Route path="/reviewer/submission/:id" element={user?.role === "reviewer" ? <SubmissionDetail /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={user ? (user.role === "reviewer" ? "/reviewer" : "/dashboard") : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
