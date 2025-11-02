import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import "../styles/LoginPage.css";

const LoginPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    gender: "rather not say", // Added gender field with default value
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin
        ? { username: formData.username, password: formData.password }
        : formData; // This now includes the gender field

      const response = await axios.post(endpoint, payload);
      const { token, username } = response.data;

      toast.success(isLogin ? "Login successful!" : "Registration successful!");
      onLogin(token, username);
    } catch (error) {
      const message = error.response?.data?.detail || "An error occurred";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-page">
      <div className="login-background">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="login-card fade-in" data-testid="login-card">
        <div className="login-header">
          <h1 className="login-title text-gradient" data-testid="login-title">
            Smart Wardrobe
          </h1>
          <p className="login-subtitle" data-testid="login-subtitle">
            Your AI-powered fashion assistant
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              className="input"
              placeholder="Enter your username"
              value={formData.username}
              onChange={handleChange}
              required
              data-testid="username-input"
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  data-testid="email-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  className="input"
                  value={formData.gender}
                  onChange={handleChange}
                  data-testid="gender-select"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="rather not say">Rather not say</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              data-testid="password-input"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
            data-testid="submit-button"
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Register"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              className="toggle-btn"
              onClick={() => setIsLogin(!isLogin)}
              data-testid="toggle-auth-button"
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;