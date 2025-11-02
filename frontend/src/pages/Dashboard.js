import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Eye, X, User, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Define your backend server's URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL || 'https://smartwardrobe-qrzg.onrender.com'
  : process.env.REACT_APP_DEV_BACKEND_URL || 'http://127.0.0.1:8000';

const Dashboard = () => {
  const [stats, setStats] = useState({ most_used: [], least_used: [] });
  const [loading, setLoading] = useState(true);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();

  // Helper function to extract error message from FastAPI error response
  const getErrorMessage = (error) => {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      
      // Handle FastAPI validation errors (array of objects)
      if (Array.isArray(detail) && detail.length > 0) {
        // Return the first error message
        return detail[0].msg || "Validation error";
      }
      
      // Handle string error messages
      if (typeof detail === 'string') {
        return detail;
      }
      
      // Handle object error messages
      if (typeof detail === 'object' && detail.msg) {
        return detail.msg;
      }
    }
    
    // Fallback to other error properties
    return error.response?.data?.message || 
          error.message || 
          "An error occurred";
  };

  // Helper function to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    // If it's already a full URL (starts with http), return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // If it's a relative path, prepend the API base URL
    return `${API_BASE_URL}${imageUrl}`;
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get("/outfits/stats");
        setStats(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get("/profile");
        setUserProfile(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setProfileLoading(false);
      }
    };
    fetchUserProfile();
  }, []);

  const markAsUsed = async (outfitId) => {
    try {
      await axios.post(`/outfits/${outfitId}/use`);
      toast.success("Outfit marked as used!");
      // Re-fetch stats to update the UI
      const response = await axios.get("/outfits/stats");
      setStats(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const viewOutfitDetails = (outfit) => {
    setSelectedOutfit(outfit);
    setShowDetails(true);
  };

  const closeModal = () => {
    setShowDetails(false);
    setSelectedOutfit(null);
  };

  // Helper function to safely render string values
  const safeRender = (value, fallback = "N/A") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading Stats...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Profile Section */}
      <div className="profile-section">
        <div className="profile-card">
          <div className="profile-header">
            <h1 className="dashboard-title">Dashboard</h1>
            <div className="profile-info">
              <div 
                className="profile-picture-container" 
                onClick={() => navigate('/profile')}
                title="Back to Dashboard"
              >
                {userProfile?.profile_pic_url ? (
                  <img 
                    src={getImageUrl(userProfile.profile_pic_url)} 
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
                onClick={() => navigate('/dashboard')}
                title="Back to Dashboard"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {/* Most Used Outfits */}
        <div className="card stat-card">
          <div className="card-header">
            <TrendingUp className="icon-primary" size={24} />
            <h2>Most Used Outfits</h2>
          </div>
          <div className="outfit-grid">
            {stats.most_used.map((outfit, index) => (
              <div key={outfit.id} className="outfit-card">
                <div className="outfit-visual">
                  {outfit.image_url ? (
                    <img 
                        src={getImageUrl(outfit.image_url)} 
                        alt={outfit.name} 
                        className="outfit-image"
                    />
                  ) : (
                    <div className="outfit-color" style={{ backgroundColor: outfit.color }}></div>
                  )}
                </div>
                <div className="outfit-info">
                  <div>
                    <h3 className="outfit-name">{safeRender(outfit.name)}</h3>
                    <p className="outfit-category">{safeRender(outfit.category)} • {safeRender(outfit.season)} • {safeRender(outfit.color)}</p>
                    <div className="outfit-stats">
                      <span className="usage-badge">{safeRender(outfit.usage_count)} times</span>
                      <button 
                        className="btn-icon" 
                        onClick={() => viewOutfitDetails(outfit)}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Least Used Outfits */}
        <div className="card stat-card">
          <div className="card-header">
            <TrendingDown className="icon-secondary" size={24} />
            <h2>Least Used Outfits</h2>
          </div>
          <div className="outfit-grid">
            {stats.least_used.map((outfit, index) => (
              <div key={outfit.id} className="outfit-card">
                <div className="outfit-visual">
                  {outfit.image_url ? (
                      <img 
                          src={getImageUrl(outfit.image_url)} 
                          alt={outfit.name} 
                          className="outfit-image"
                      />
                  ) : (
                      <div className="outfit-color" style={{ backgroundColor: outfit.color }}></div>
                  )}
                </div>
                <div className="outfit-info">
                  <div>
                    <h3 className="outfit-name">{safeRender(outfit.name)}</h3>
                    <p className="outfit-category">{safeRender(outfit.category)} • {safeRender(outfit.season)} • {safeRender(outfit.color)}</p>
                    <div className="outfit-actions">
                      <button className="btn-small btn-primary" onClick={() => markAsUsed(outfit.id)}>
                        Wear Today
                      </button>
                      <button 
                        className="btn-icon" 
                        onClick={() => viewOutfitDetails(outfit)}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Outfit Details Modal */}
      {showDetails && selectedOutfit && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{safeRender(selectedOutfit.name)}</h2>
              <button className="btn-close" onClick={() => setShowDetails(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="outfit-detail-visual">
                {selectedOutfit.image_url ? (
                  <img 
                      src={getImageUrl(selectedOutfit.image_url)} 
                      alt={selectedOutfit.name} 
                      className="outfit-detail-image"
                  />
                ) : (
                  <div className="outfit-detail-color" style={{ backgroundColor: selectedOutfit.color }}>
                    <span>No Image</span>
                  </div>
                )}
              </div>
              <div className="outfit-details">
                <div className="detail-row">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{safeRender(selectedOutfit.category)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Season:</span>
                  <span className="detail-value">{safeRender(selectedOutfit.season)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Color:</span>
                  <span className="detail-value">{safeRender(selectedOutfit.color)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Times Worn:</span>
                  <span className="detail-value">{safeRender(selectedOutfit.usage_count)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>Close</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  markAsUsed(selectedOutfit.id);
                  closeModal();
                }}
              >
                Wear Today
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom styles for proper alignment */}
      <style jsx>{`
        .profile-section {
          margin-bottom: 1.5rem;
        }
        
        .profile-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px var(--color-shadow);
          padding: 1rem;
        }
        
        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .dashboard-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--color-primary-dark);
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
          background-color: var(--color-background);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-light);
        }
        
        .profile-details {
          display: flex;
          flex-direction: column;
        }
        
        .profile-greeting {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          color: var(--color-primary);
        }
        
        .profile-settings {
          background-color: var(--color-background);
          border-radius: 50%;
          padding: 0.5rem;
          transition: background-color 0.2s ease;
        }
        
        .profile-settings:hover {
          background-color: #e0e0e0;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
          gap: 32px;
        }
        
        .outfit-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        
        .outfit-card {
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px var(--color-shadow);
          transition: transform 0.2s ease;
        }
        
        .outfit-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 4px 12px var(--color-shadow);
        }
        
        .outfit-visual {
          width: 100%;
          height: 200px;
          overflow: hidden;
        }
        
        .outfit-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 4px;
        }
        
        .outfit-color {
          width: 100%;
          height: 100%;
          border-radius: 4px;
        }
        
        .outfit-info {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .outfit-name {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .outfit-category {
          font-size: 0.875rem;
          color: var(--color-text-light);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .outfit-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.25rem;
        }
        
        .usage-badge {
          font-size: 0.75rem;
          background-color: var(--color-primary);
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
        }
        
        .btn-small {
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
        }
        
        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-light);
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .btn-icon:hover {
          background-color: rgba(0, 0, 0, 0.05);
          color: var(--color-text);
        }
        
        @media (max-width: 1024px) {
          .outfit-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .profile-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          
          .dashboard-title {
            font-size: 2rem;
            align-self: flex-start;
          }
        }
        
        @media (max-width: 640px) {
          .outfit-grid {
            grid-template-columns: 1fr;
          }
          
          .dashboard-title {
            font-size: 2rem;
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;