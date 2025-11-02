import { useState, useEffect } from "react";
import "@/App.css"; // This will now contain the main layout styles
import "@/Sidebar.css"; // Import the new sidebar styles
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

// Import your new page components
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AllOutfitsPage from "./pages/AllOutfitsPage";
import AISuggestionsPage from "./pages/AISuggestionsPage";
import GroupsPage from "./pages/GroupsPage"; // Import the new GroupsPage component
import Profile from "./pages/Profile"; // Import the Profile component
import SharedOutfitPage from "./pages/SharedOutfitPage"; // Import the new SharedOutfitPage component

// Import your new Sidebar component
import Sidebar from "./components/ui/sidebar";

// FIXED: Updated backend URL configuration for deployment
// This now checks if we're in production or development
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL
  : process.env.REACT_APP_DEV_BACKEND_URL;

const API = `${BACKEND_URL}/api`;

// Set up axios defaults
axios.defaults.baseURL = API;

// Add auth token to all requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // Using "token" as in your original code
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return Promise.reject(error);
    }
    
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.href = "/login";
      toast.error("Session expired. Please login again.");
    }
    
    // Handle other errors
    const errorMessage = error.response?.data?.detail || 
                        error.response?.data?.message || 
                        error.message || 
                        "An error occurred";
    
    toast.error(errorMessage);
    return Promise.reject(error);
  }
);

// 404 Component for authenticated users
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

// 404 Component for non-authenticated users
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
    // Navigate to dashboard after successful login
    window.location.href = "/dashboard";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    toast.success("Logged out successfully!");
    // Navigate to login after logout
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
        // Main application layout with Sidebar
        <div className="app-container">
          <Sidebar onLogout={handleLogout} />
          <main className="main-content">
            <Routes>
              {/* Add redirect from root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/outfits" element={<AllOutfitsPage />} />
              <Route path="/groups" element={<GroupsPage />} /> {/* Add Groups route */}
              <Route path="/suggestions" element={<AISuggestionsPage />} />
              <Route path="/profile" element={<Profile />} /> {/* Add Profile route */}
              {/* 404 page for authenticated users */}
              <Route path="*" element={<AuthenticatedNotFound />} />
            </Routes>
          </main>
        </div>
      ) : (
        // Routes for non-authenticated users
        <Routes>
          {/* Add redirect from root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          {/* Shared outfit route - accessible without authentication */}
          <Route path="/shared-outfit/:shareToken" element={<SharedOutfitPage />} />
          {/* 404 page for non-authenticated users */}
          <Route path="*" element={<UnauthenticatedNotFound />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;