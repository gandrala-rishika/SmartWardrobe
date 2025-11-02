import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Plus, Calendar, Tag, Palette, User, Star } from "lucide-react";

// Define your backend server's URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL || 'https://smartwardrobe-qrzg.onrender.com'
  : process.env.REACT_APP_DEV_BACKEND_URL || 'http://127.0.0.1:8000';

const SharedOutfitPage = () => {
  const { shareToken } = useParams();
  const [outfit, setOutfit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToWardrobe, setAddingToWardrobe] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSharedOutfit();
    checkAuthStatus();
  }, [shareToken]);

  const checkAuthStatus = () => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  };

  const fetchSharedOutfit = async () => {
    try {
      const response = await axios.get(`/shared-outfit/${shareToken}`);
      setOutfit(response.data);
    } catch (error) {
      setError(error.response?.data?.detail || "Failed to load shared outfit");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWardrobe = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    setAddingToWardrobe(true);
    try {
      await axios.post(`/shared-outfit/${shareToken}/add-to-wardrobe`);
      toast.success("Outfit added to your wardrobe!");
      navigate("/outfits");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add outfit to wardrobe");
    } finally {
      setAddingToWardrobe(false);
    }
  };

  const handleLoginRedirect = () => {
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading shared outfit...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="shared-outfit-page">
      <div className="shared-outfit-container">
        <button 
          className="btn btn-secondary back-button" 
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>
        
        <div className="shared-outfit-card">
          <div className="shared-outfit-header">
            <h1>{outfit.name}</h1>
            <div className="outfit-meta">
              <div className="meta-item">
                <Tag size={16} />
                <span>{outfit.category}</span>
              </div>
              <div className="meta-item">
                <Calendar size={16} />
                <span>{outfit.season}</span>
              </div>
              <div className="meta-item">
                <Palette size={16} />
                <span>{outfit.color}</span>
              </div>
            </div>
          </div>
          
          <div className="shared-outfit-image">
            {outfit.image_url ? (
              <img 
                src={outfit.image_url} 
                alt={outfit.name} 
                className="outfit-image"
              />
            ) : (
              <div className="outfit-color-placeholder" style={{ backgroundColor: outfit.color }}>
                <span>No Image Available</span>
              </div>
            )}
          </div>
          
          <div className="shared-outfit-actions">
            <button 
              className={`btn ${isAuthenticated ? "btn-primary" : "btn-secondary"}`} 
              onClick={handleAddToWardrobe}
              disabled={addingToWardrobe}
            >
              {addingToWardrobe ? (
                <>
                  <div className="spinner"></div>
                  Adding to Wardrobe...
                </>
              ) : isAuthenticated ? (
                <>
                  <Plus size={16} />
                  Add to My Wardrobe
                </>
              ) : (
                <>
                  <User size={16} />
                  Login to Add to Wardrobe
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="shared-outfit-footer">
          <p>This outfit was shared with you. {isAuthenticated ? "Click the button above to add it to your wardrobe." : "Login to add this outfit to your wardrobe."}</p>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Login Required</h2>
              <button className="btn-close" onClick={() => setShowLoginModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>You need to login to add this outfit to your wardrobe.</p>
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowLoginModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleLoginRedirect}
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .shared-outfit-page {
          min-height: 100vh;
          background-color: #f8f9fa;
          padding: 2rem 1rem;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .shared-outfit-container {
          max-width: 600px;
          width: 100%;
        }
        
        .back-button {
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .shared-outfit-card {
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .shared-outfit-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .shared-outfit-header h1 {
          margin: 0 0 1rem 0;
          font-size: 1.875rem;
          font-weight: 700;
          color: #2d3748;
        }
        
        .outfit-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.875rem;
          color: #4a5568;
          background-color: #f7fafc;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }
        
        .shared-outfit-image {
          padding: 1.5rem;
          display: flex;
          justify-content: center;
        }
        
        .outfit-image {
          max-width: 100%;
          max-height: 400px;
          border-radius: 8px;
          object-fit: contain;
        }
        
        .outfit-color-placeholder {
          width: 200px;
          height: 200px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 500;
        }
        
        .shared-outfit-actions {
          padding: 1.5rem;
          border-top: 1px solid #e2e8f0;
        }
        
        .shared-outfit-footer {
          margin-top: 1.5rem;
          text-align: center;
          color: #718096;
          font-size: 0.875rem;
        }
        
        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          text-align: center;
        }
        
        .error-container h2 {
          color: #e53e3e;
          margin-bottom: 1rem;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          display: inline-block;
          margin-right: 0.5rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background-color: white;
          border-radius: 8px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .modal-header h2 {
          margin: 0;
          color: #2d3748;
        }
        
        .btn-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .btn-close:hover {
          background-color: #f0f0f0;
        }
        
        .modal-body {
          margin-bottom: 1.5rem;
        }
        
        .modal-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        
        @media (max-width: 640px) {
          .shared-outfit-page {
            padding: 1rem 0.5rem;
          }
          
          .shared-outfit-header h1 {
            font-size: 1.5rem;
          }
          
          .outfit-meta {
            gap: 0.5rem;
          }
          
          .shared-outfit-card {
            max-width: 90%;
          }
        }
      `}</style>
    </div>
  );
};

export default SharedOutfitPage;