import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "./api/client";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import MerchantKYC from "./pages/MerchantKYC";
import MerchantDashboard from "./pages/MerchantDashboard";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import SubmissionDetail from "./pages/SubmissionDetail";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);

  useEffect(() => {
    // 1. Load user from local storage
    const stored = localStorage.getItem("user");
    if (stored) { try { setUser(JSON.parse(stored)); } catch { localStorage.clear(); } }
    setLoading(false);

    // 2. Global Axios interceptor for Render free tier sleep
    let activeSlowRequests = 0;
    
    const reqInterceptor = api.interceptors.request.use((config) => {
      config.timeoutId = setTimeout(() => {
        activeSlowRequests++;
        setServerWaking(true);
      }, 2500); // If any request takes > 2.5s, assume Render is waking up
      return config;
    });

    const resInterceptor = api.interceptors.response.use(
      (response) => {
        clearTimeout(response.config.timeoutId);
        if (response.config.timeoutId) {
          activeSlowRequests = Math.max(0, activeSlowRequests - 1);
          if (activeSlowRequests === 0) setServerWaking(false);
        }
        return response;
      },
      (error) => {
        if (error.config && error.config.timeoutId) {
          clearTimeout(error.config.timeoutId);
          activeSlowRequests = Math.max(0, activeSlowRequests - 1);
          if (activeSlowRequests === 0) setServerWaking(false);
        }
        return Promise.reject(error);
      }
    );

    // Fire a silent background ping immediately to wake Render up ASAP
    api.get("/auth/me/").catch(() => {});

    return () => {
      api.interceptors.request.eject(reqInterceptor);
      api.interceptors.response.eject(resInterceptor);
    };
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
      
      {/* Global Server Waking Indicator */}
      {serverWaking && (
        <div className="animate-slide-in" style={{
          position: "fixed", bottom: 30, right: 30, zIndex: 9999,
          background: "rgba(30, 41, 59, 0.95)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: 12,
          padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
        }}>
          <span className="spinner" style={{ width: 22, height: 22, borderColor: "rgba(167, 139, 250, 0.2)", borderTopColor: "#a78bfa", animationDuration: "1s" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>Please wait...</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Loading, this may take a moment.</div>
          </div>
        </div>
      )}

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
