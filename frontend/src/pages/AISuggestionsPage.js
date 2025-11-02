import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, Cloud, Star, Plus, User, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Define your backend server's URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL
  : process.env.REACT_APP_DEV_BACKEND_URL;

const AISuggestionsPage = () => {
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [weatherSuggestions, setWeatherSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: null, lon: null });
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getUserLocation();
    fetchUserProfile();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => console.error("Location error:", error)
      );
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get("/profile");
      // Convert relative URL to absolute URL if needed
      if (response.data.profile_pic_url) {
        const imageUrl = response.data.profile_pic_url.startsWith('http') 
          ? response.data.profile_pic_url 
          : `${API_BASE_URL}${response.data.profile_pic_url}`;
        setUserProfile({
          ...response.data,
          profile_pic_url: imageUrl
        });
      } else {
        setUserProfile(response.data);
      }
    } catch (error) {
      toast.error("Failed to fetch profile data");
    } finally {
      setProfileLoading(false);
    }
  };

  const getAISuggestions = async () => {
    setAiLoading(true);
    try {
      // Remove /api prefix since it's likely already configured in axios baseURL
      const response = await axios.post("/suggestions/ai");
      setAiSuggestions(response.data.suggestions);
      toast.success(response.data.reasoning);
    } catch (error) {
      toast.error("Failed to get AI suggestions");
    } finally {
      setAiLoading(false);
    }
  };

  const getWeatherSuggestions = async () => {
    setWeatherLoading(true);
    try {
      // Remove /api prefix since it's likely already configured in axios baseURL
      const params = userLocation.lat && userLocation.lon ? `?lat=${userLocation.lat}&lon=${userLocation.lon}` : "";
      const response = await axios.get(`/suggestions/weather${params}`);
      setWeatherSuggestions(response.data.suggestions);
      toast.success(response.data.reasoning);
    } catch (error) {
      toast.error("Failed to get weather suggestions");
    } finally {
      setWeatherLoading(false);
    }
  };

  // Function to get recommendation level class
  const getRecommendationClass = (level) => {
    switch (level) {
      case "mostly recommended":
        return "recommendation-most";
      case "recommended":
        return "recommendation-recommended";
      case "least recommended":
        return "recommendation-least";
      default:
        return "";
    }
  };

  // Function to get recommendation icon
  const getRecommendationIcon = (level) => {
    switch (level) {
      case "mostly recommended":
        return <Star size={16} fill="#4caf50" color="#4caf50" />;
      case "recommended":
        return <Star size={16} fill="#ffc107" color="#ffc107" />;
      case "least recommended":
        return <Star size={16} fill="#9c27b0" color="#9c27b0" />;
      default:
        return <Star size={16} fill="#ddd" color="#ddd" />;
    }
  };

  return (
    <div className="page-content">
      {/* Profile Section */}
      <div className="profile-section">
        <div className="profile-card">
          <div className="profile-header">
            <h1 className="page-title">AI Suggestions</h1>
            <div className="profile-info">
              <div 
                className="profile-picture-container" 
                onClick={() => navigate('/profile')}
                title="Click to view profile"
              >
                {userProfile?.profile_pic_url ? (
                  <img 
                    src={userProfile.profile_pic_url} 
                    alt="Profile" 
                    className="profile-picture"
                  />
                ) : (
                  <div className="profile-picture-placeholder">
                    <User size={24} />
                  </div>
                )}
              </div>
              <div className="profile-details">
                <p className="profile-greeting">Hi, {userProfile?.username || "User"}</p>
              </div>
              <button 
                className="btn-icon profile-settings" 
                onClick={() => navigate('/profile')}
                title="Profile Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="suggestions-grid">
        {/* AI Suggestions */}
        <div className="card suggestion-card">
          <div className="card-header">
            <Sparkles className="icon-accent" size={24} />
            <h2>Style Suggestions</h2>
          </div>
          <p className="card-description" style={{ marginBottom: '1rem' }}>Get personalized styling tips for your least-worn outfits.</p>
          <button className="btn btn-primary" onClick={getAISuggestions} disabled={aiLoading}>
            {aiLoading ? "Loading..." : "Get AI Suggestions"}
          </button>
          {aiSuggestions.length > 0 && (
            <div className="suggestions-list">
              {aiSuggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-item">
                  <h4>{suggestion.outfit_name}</h4>
                  <p className="suggestion-tip">{suggestion.styling_tip}</p>
                  <span className="suggestion-occasion">{suggestion.occasion}</span>
                  {suggestion.complementary_items && suggestion.complementary_items.length > 0 && (
                    <div className="complementary-items">
                      <div className="complementary-header">
                        <Plus size={16} className="complementary-icon" />
                        <span className="complementary-label">Pairs well with:</span>
                      </div>
                      <div className="complementary-list">
                        {suggestion.complementary_items.map((item, itemIndex) => (
                          <span key={itemIndex} className="complementary-item">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weather Suggestions */}
        <div className="card suggestion-card">
          <div className="card-header">
            <Cloud className="icon-weather" size={24} />
            <h2>Weather-Based Suggestions</h2>
          </div>
          <p className="card-description" style={{ marginBottom: '1rem' }}>Perfect outfits for today's weather.</p>
          <button className="btn btn-secondary" onClick={getWeatherSuggestions} disabled={weatherLoading}>
            {weatherLoading ? "Loading..." : "Get Weather Suggestions"}
          </button>
          {weatherSuggestions.length > 0 && (
            <div className="suggestions-list">
              {weatherSuggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-item">
                  <div className="suggestion-header">
                    <h4>{suggestion.outfit_name}</h4>
                    <div className={`recommendation-badge ${getRecommendationClass(suggestion.recommendation_level)}`}>
                      {getRecommendationIcon(suggestion.recommendation_level)}
                      <span style={{ marginLeft: '4px' }}>{suggestion.recommendation_level}</span>
                    </div>
                  </div>
                  <p className="suggestion-tip">{suggestion.styling_tip}</p>
                  <div className="suggestion-details">
                    <span className="suggestion-occasion">{suggestion.occasion}</span>
                    <span className="suggestion-reason">{suggestion.reason}</span>
                  </div>
                  {suggestion.complementary_items && suggestion.complementary_items.length > 0 && (
                    <div className="complementary-items">
                      <div className="complementary-header">
                        <Plus size={16} className="complementary-icon" />
                        <span className="complementary-label">Pairs well with:</span>
                      </div>
                      <div className="complementary-list">
                        {suggestion.complementary_items.map((item, itemIndex) => (
                          <span key={itemIndex} className="complementary-item">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Add custom styles for the profile section */}
      <style jsx>{`
        .profile-section {
          margin-bottom: 1.5rem;
        }
        
        .profile-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 1rem;
        }
        
        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .page-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: #4a5568;
          margin: 0;
          align-self: center;
        }
        
        .profile-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .profile-picture-container {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .profile-picture-container:hover {
          transform: scale(1.05);
        }
        
        .profile-picture {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .profile-picture-placeholder {
          width: 100%;
          height: 100%;
          background-color: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }
        
        .profile-details {
          display: flex;
          flex-direction: column;
        }
        
        .profile-greeting {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          color: #5a67d8; /* A pleasant blue color */
        }
        
        .profile-settings {
          background-color: #f0f0f0;
          border-radius: 50%;
          padding: 0.5rem;
          transition: background-color 0.2s ease;
        }
        
        .profile-settings:hover {
          background-color: #e0e0e0;
        }
        
        @media (max-width: 640px) {
          .profile-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          
          .page-title {
            font-size: 2rem;
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default AISuggestionsPage;