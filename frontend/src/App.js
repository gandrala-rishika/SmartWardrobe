import { useState, useEffect } from "react";
import "@/App.css";
import "@/Sidebar.css";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";


import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AllOutfitsPage from "./pages/AllOutfitsPage";
import AISuggestionsPage from "./pages/AISuggestionsPage";
import GroupsPage from "./pages/GroupsPage";
import Profile from "./pages/Profile";
import SharedOutfitPage from "./pages/SharedOutfitPage";

import Sidebar from "./components/ui/sidebar";

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? process.env.REACT_APP_PROD_BACKEND_URL
  : process.env.REACT_APP_DEV_BACKEND_URL;

const API = `${BACKEND_URL}/api`;

axios.defaults.baseURL = API;

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.href = "/login";
      toast.error("Session expired. Please login again.");
    }

    const errorMessage = error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An error occurred";

    toast.error(errorMessage);
    return Promise.reject(error);
  }
);

const AuthenticatedNotFound = () => {
  return (
    <div className="not-found-container">
      <h2>404 - Page Not Found</h2>
      <p>The page you're looking for doesn't exist in your wardrobe.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
};

const UnauthenticatedNotFound = () => {
  return (
    <div className="not-found-container">
      <h2>404 - Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/login" className="btn btn-primary">
        Go to Login
      </Link>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, username) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setIsAuthenticated(true);
    window.location.href = "/dashboard";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    toast.success("Logged out successfully!");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <div className="app-container">
          <Sidebar onLogout={handleLogout} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/outfits" element={<AllOutfitsPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/suggestions" element={<AISuggestionsPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<AuthenticatedNotFound />} />
            </Routes>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/shared-outfit/:shareToken" element={<SharedOutfitPage />} />
          <Route path="*" element={<UnauthenticatedNotFound />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;