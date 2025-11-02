import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Edit2, Eye, X, User, Settings, Share2, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Define your backend server's URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL
  : process.env.REACT_APP_DEV_BACKEND_URL;

const AllOutfitsPage = () => {
  const [allOutfits, setAllOutfits] = useState([]);
  const [outfitsLoading, setOutfitsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isAddingOutfit, setIsAddingOutfit] = useState(false);
  const [isUpdatingOutfit, setIsUpdatingOutfit] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const navigate = useNavigate();
  
  // Share functionality states
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  
  const [newOutfit, setNewOutfit] = useState({ 
    name: '', 
    category: 'casual', 
    season: 'all', 
    color: '',
    image_url: ''
  });
  
  const [editOutfit, setEditOutfit] = useState({ 
    name: '', 
    category: 'casual', 
    season: 'all', 
    color: '',
    image_url: ''
  });

  // Helper function to extract error message from FastAPI error response
  const getErrorMessage = (error) => {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      
      // Handle FastAPI validation errors (array of objects)
      if (Array.isArray(detail) && detail.length > 0) {
        // Join all error messages into a single, readable string
        return detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n');
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

  useEffect(() => {
    fetchAllOutfits();
    fetchUserProfile();
  }, []);

  const fetchAllOutfits = async () => {
    setOutfitsLoading(true);
    try {
      const response = await axios.get("/outfits");
      setAllOutfits(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setOutfitsLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get("/profile");
      setUserProfile(response.data);
      // Convert relative URL to absolute URL if needed
      if (response.data.profile_pic_url) {
        const imageUrl = response.data.profile_pic_url.startsWith('http') 
          ? response.data.profile_pic_url 
          : `${API_BASE_URL}${response.data.profile_pic_url}`;
        setUserProfile({
          ...response.data,
          profile_pic_url: imageUrl
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddOutfit = async (e) => {
    e.preventDefault();
    if (!newOutfit.name || !newOutfit.color) {
      toast.error("Name and color are required.");
      return;
    }
    setIsAddingOutfit(true);
    try {
      const hasImage = fileInputRef.current && fileInputRef.current.files[0];

      const formData = new FormData();
      formData.append('name', newOutfit.name);
      formData.append('category', newOutfit.category);
      formData.append('season', newOutfit.season);
      formData.append('color', newOutfit.color);
      if (newOutfit.image_url) {
        formData.append('image_url', newOutfit.image_url);
      }
      if (hasImage) {
        formData.append('image', fileInputRef.current.files[0]);
      }

      await axios.post("/outfits", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success("Outfit added successfully!");
      resetForm();
      fetchAllOutfits();
    } catch (error) {
      console.error("Add outfit failed:", error.response?.data);
      toast.error(getErrorMessage(error));
    } finally {
      setIsAddingOutfit(false);
    }
  };

  const handleUpdateOutfit = async (e) => {
    e.preventDefault();

    if (!selectedOutfit || !selectedOutfit.id) {
      toast.error("No outfit selected for update. Please try again.");
      return;
    }

    if (!editOutfit.name || !editOutfit.color) {
      toast.error("Name and color are required.");
      return;
    }
    setIsUpdatingOutfit(true);
    try {
      const hasNewImage = editFileInputRef.current && editFileInputRef.current.files[0];
      
      const formData = new FormData();
      formData.append('name', editOutfit.name);
      formData.append('category', editOutfit.category);
      formData.append('season', editOutfit.season);
      formData.append('color', editOutfit.color);
      if (editOutfit.image_url) {
        formData.append('image_url', editOutfit.image_url);
      }
      if (hasNewImage) {
        formData.append('image', editFileInputRef.current.files[0]);
      }
      
      await axios.put(`/outfits/${selectedOutfit.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    
      toast.success("Outfit updated successfully!");
      resetEditForm();
      fetchAllOutfits();
    } catch (error) {
      console.error("Update outfit failed. Server response:", error.response?.data);
      toast.error(getErrorMessage(error));
    } finally {
      setIsUpdatingOutfit(false);
    }
  };

  const handleDeleteOutfit = async (outfitId, outfitName) => {
    if (!window.confirm(`Are you sure you want to delete "${outfitName}"?`)) return;
    try {
      await axios.delete(`/outfits/${outfitId}`);
      toast.success("Outfit deleted successfully!");
      fetchAllOutfits();
    } catch (error) {
      console.error("Delete outfit failed:", error.response?.data);
      toast.error(getErrorMessage(error));
    }
  };

  const openEditForm = (outfit) => {
    setSelectedOutfit(outfit);
    setEditOutfit({
      name: outfit.name,
      category: outfit.category,
      season: outfit.season,
      color: outfit.color,
      image_url: outfit.image_url
    });
    // This is a relative URL, so it needs the base URL prepended for display
    setEditImagePreview(outfit.image_url);
    setShowEditForm(true);
    setShowAddForm(false);
  };

  const viewOutfitDetails = (outfit) => {
    setSelectedOutfit(outfit);
    setShowDetails(true);
  };

  // Share functionality
  const handleShareOutfit = async (outfit) => {
    setSelectedOutfit(outfit);
    setIsGeneratingShareLink(true);
    
    try {
      const response = await axios.post(`/outfits/${outfit.id}/share`);
      // Construct the full URL using the current origin
      const fullShareUrl = `${window.location.origin}${response.data.share_url}`;
      setShareUrl(fullShareUrl);
      setShareModalOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        toast.error("Failed to copy link to clipboard");
      });
  };

  const resetForm = () => {
    setNewOutfit({ name: '', category: 'casual', season: 'all', color: '', image_url: '' });
    setImagePreview(null);
    setShowAddForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetEditForm = () => {
    setEditOutfit({ name: '', category: 'casual', season: 'all', color: '', image_url: '' });
    setEditImagePreview(null);
    setShowEditForm(false);
    setSelectedOutfit(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  return (
    <div className="page-content">
      {/* Profile Section */}
      <div className="profile-section">
        <div className="profile-card">
          <div className="profile-header">
            <h1 className="page-title">All Outfits</h1>
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

      <div className="card">
        <div className="card-header">
          <Plus className="icon-primary" size={24} />
          <h2>Manage Your Wardrobe</h2>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setShowAddForm(!showAddForm);
          setShowEditForm(false);
        }}>
          {showAddForm ? "Cancel" : "Add New Outfit"}
        </button>

        {showAddForm && (
          <form className="add-outfit-form" onSubmit={handleAddOutfit}>
            <input
              type="text"
              placeholder="Outfit Name (e.g., Winter Parka)"
              value={newOutfit.name}
              onChange={(e) => setNewOutfit({ ...newOutfit, name: e.target.value })}
              required
            />
            <select value={newOutfit.category} onChange={(e) => setNewOutfit({ ...newOutfit, category: e.target.value })}>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="sport">Sport</option>
              <option value="traditional">Traditional</option>
            </select>
            <select value={newOutfit.season} onChange={(e) => setNewOutfit({ ...newOutfit, season: e.target.value })}>
              <option value="all">All Season</option>
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
              <option value="winter">Winter</option>
            </select>
            <input type="text" placeholder="Color" value={newOutfit.color} onChange={(e) => setNewOutfit({ ...newOutfit, color: e.target.value })} required />
            
            <div className="image-upload-container">
              <label htmlFor="outfit-image" className="image-upload-label">
                {imagePreview ? (
                  <img src={imagePreview} alt="Outfit preview" className="image-preview" />
                ) : (
                  <div className="image-upload-placeholder">
                    <Plus size={24} />
                    <span>Add Image</span>
                  </div>
                )}
              </label>
              <input
                id="outfit-image"
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={isAddingOutfit}>
              {isAddingOutfit ? "Adding..." : "Add Outfit"}
            </button>
          </form>
        )}

        {showEditForm && (
          <form className="add-outfit-form" onSubmit={handleUpdateOutfit}>
            <input
              type="text"
              placeholder="Outfit Name"
              value={editOutfit.name}
              onChange={(e) => setEditOutfit({ ...editOutfit, name: e.target.value })}
              required
            />
            <select value={editOutfit.category} onChange={(e) => setEditOutfit({ ...editOutfit, category: e.target.value })}>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="sport">Sport</option>
              <option value="traditional">Traditional</option>
            </select>
            <select value={editOutfit.season} onChange={(e) => setEditOutfit({ ...editOutfit, season: e.target.value })}>
              <option value="all">All Season</option>
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
              <option value="winter">Winter</option>
            </select>
            <input type="text" placeholder="Color" value={editOutfit.color} onChange={(e) => setEditOutfit({ ...editOutfit, color: e.target.value })} required />
            
            <div className="image-upload-container">
              <label htmlFor="edit-outfit-image" className="image-upload-label">
                {editImagePreview ? (
                  // Handle both data URLs (from new file) and absolute URLs (from existing outfit)
                  <img 
                    src={editImagePreview.startsWith('data:') ? editImagePreview : editImagePreview} 
                    alt="Outfit preview" 
                    className="image-preview" 
                  />
                ) : (
                  <div className="image-upload-placeholder">
                    <Plus size={24} />
                    <span>Add Image</span>
                  </div>
                )}
              </label>
              <input
                id="edit-outfit-image"
                type="file"
                ref={editFileInputRef}
                onChange={handleEditImageChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetEditForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isUpdatingOutfit}>
                {isUpdatingOutfit ? "Updating..." : "Update Outfit"}
              </button>
            </div>
          </form>
        )}

        <div className="outfit-list" style={{ marginTop: '1.5rem' }}>
          {outfitsLoading ? (<p>Loading outfits...</p>) : (
            allOutfits.map((outfit) => (
              <div key={outfit.id} className="outfit-item">
                <div className="outfit-visual">
                  {outfit.image_url ? (
                    <img 
                      src={outfit.image_url} 
                      alt={outfit.name} 
                      className="outfit-thumbnail"
                    />
                  ) : (
                    <div className="outfit-color" style={{ backgroundColor: outfit.color }}></div>
                  )}
                </div>
                <div className="outfit-info">
                  <div>
                    <h3 className="outfit-name">{outfit.name}</h3>
                    <p className="outfit-category">{outfit.category} • {outfit.season} • {outfit.color}</p>
                  </div>
                </div>
                <div className="outfit-actions">
                  <button 
                    className="btn-icon" 
                    onClick={() => viewOutfitDetails(outfit)}
                    title="View details"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    className="btn-icon" 
                    onClick={() => openEditForm(outfit)}
                    title="Edit outfit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    className="btn-icon btn-share" 
                    onClick={() => handleShareOutfit(outfit)}
                    title="Share outfit"
                    disabled={isGeneratingShareLink}
                  >
                    {isGeneratingShareLink && selectedOutfit?.id === outfit.id ? 
                      <Loader2 size={16} className="animate-spin" /> : 
                      <Share2 size={16} />
                    }
                  </button>
                  <button 
                    className="btn-icon btn-danger" 
                    onClick={() => handleDeleteOutfit(outfit.id, outfit.name)} 
                    title="Delete Outfit"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Outfit Details Modal */}
      {showDetails && selectedOutfit && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedOutfit.name}</h2>
              <button className="btn-close" onClick={() => setShowDetails(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="outfit-detail-visual">
                {selectedOutfit.image_url ? (
                  <img 
                    src={selectedOutfit.image_url} 
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
                  <span className="detail-value">{selectedOutfit.category}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Season:</span>
                  <span className="detail-value">{selectedOutfit.season}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Color:</span>
                  <span className="detail-value">{selectedOutfit.color}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Times Worn:</span>
                  <span className="detail-value">{selectedOutfit.usage_count}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>Close</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  openEditForm(selectedOutfit);
                  setShowDetails(false);
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share Outfit</h2>
              <button className="btn-close" onClick={() => setShareModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Share this link with others to let them view this outfit:</p>
              <div className="share-url-container">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  className="share-url-input"
                />
                <button 
                  className="btn btn-icon copy-btn" 
                  onClick={copyToClipboard}
                  title={copySuccess ? "Copied!" : "Copy to clipboard"}
                >
                  {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="share-note">
                Note: This link will expire in 30 days. anyone with the link can view this outfit.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShareModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom styles for the profile section and share functionality */}
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
        
        /* Share button styles */
        .btn-share {
          color: #4299e1;
        }
        
        .btn-share:hover {
          color: #2b6cb0;
          background-color: rgba(66, 153, 225, 0.1);
        }
        
        /* Share modal styles */
        .share-modal {
          max-width: 500px;
        }
        
        .share-url-container {
          display: flex;
          margin: 1rem 0;
        }
        
        .share-url-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 4px 0 0 4px;
          font-family: monospace;
          font-size: 0.875rem;
        }
        
        .copy-btn {
          border-radius: 0 4px 4px 0;
          border-left: none;
        }
        
        .share-note {
          font-size: 0.875rem;
          color: #718096;
          margin-top: 0.5rem;
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
          
          .share-modal {
            max-width: 90%;
          }
        }
      `}</style>
    </div>
  );
};

export default AllOutfitsPage;