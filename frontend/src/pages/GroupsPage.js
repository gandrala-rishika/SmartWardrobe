import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Edit2, Eye, X, User, Settings, Share2, Copy, Check, Users, Star, StarOff, LogIn, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Define your backend server's URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL || "https://smartwardrobe-qrzg.onrender.com"
  : process.env.REACT_APP_DEV_BACKEND_URL || "http://127.0.0.1:8000";

const GroupsPage = () => {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupDetailsLoading, setGroupDetailsLoading] = useState(false);
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);
  const [showJoinGroupForm, setShowJoinGroupForm] = useState(false);
  const [showShareOutfitForm, setShowShareOutfitForm] = useState(false);
  const [userOutfits, setUserOutfits] = useState([]);
  const [userOutfitsLoading, setUserOutfitsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isSharingOutfit, setIsSharingOutfit] = useState(false);
  const [isRatingOutfit, setIsRatingOutfit] = useState(false);
  const [ratingOutfitId, setRatingOutfitId] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const navigate = useNavigate();
  
  const [newGroup, setNewGroup] = useState({ 
    name: '', 
    description: ''
  });
  
  const [joinGroupData, setJoinGroupData] = useState({
    invite_code: ''
  });
  
  const [shareOutfitData, setShareOutfitData] = useState({
    outfit_id: ''
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
    fetchGroups();
    fetchUserProfile();
  }, []);

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      const response = await axios.get("/groups");
      setGroups(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    setGroupDetailsLoading(true);
    try {
      const response = await axios.get(`/groups/${groupId}`);
      setGroupDetails(response.data);
      setSelectedGroup(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGroupDetailsLoading(false);
    }
  };

  const fetchUserOutfits = async () => {
    setUserOutfitsLoading(true);
    try {
      const response = await axios.get("/outfits");
      setUserOutfits(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUserOutfitsLoading(false);
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
      toast.error(getErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.name) {
      toast.error("Group name is required.");
      return;
    }
    setIsCreatingGroup(true);
    try {
      await axios.post("/groups/create", newGroup);
      toast.success("Group created successfully!");
      resetCreateGroupForm();
      fetchGroups();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinGroupData.invite_code) {
      toast.error("Invite code is required.");
      return;
    }
    setIsJoiningGroup(true);
    try {
      await axios.post("/groups/join", joinGroupData);
      toast.success("Joined group successfully!");
      resetJoinGroupForm();
      fetchGroups();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsJoiningGroup(false);
    }
  };

  const handleShareOutfit = async (e) => {
    e.preventDefault();
    if (!shareOutfitData.outfit_id) {
      toast.error("Please select an outfit to share.");
      return;
    }
    setIsSharingOutfit(true);
    try {
      await axios.post(`/groups/${selectedGroup.id}/share`, {
        outfit_id: shareOutfitData.outfit_id
      }, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("Outfit shared successfully!");
      resetShareOutfitForm();
      fetchGroupDetails(selectedGroup.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSharingOutfit(false);
    }
  };

  const handleRateOutfit = async (outfitId, rating) => {
    setIsRatingOutfit(true);
    setRatingOutfitId(outfitId);
    try {
      await axios.post(`/groups/${selectedGroup.id}/outfits/${outfitId}/rate`, {
        rating: rating
      });
      toast.success("Rating submitted successfully!");
      fetchGroupDetails(selectedGroup.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRatingOutfit(false);
      setRatingOutfitId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const resetCreateGroupForm = () => {
    setNewGroup({ name: '', description: '' });
    setShowCreateGroupForm(false);
  };

  const resetJoinGroupForm = () => {
    setJoinGroupData({ invite_code: '' });
    setShowJoinGroupForm(false);
  };

  const resetShareOutfitForm = () => {
    setShareOutfitData({ outfit_id: '' });
    setShowShareOutfitForm(false);
  };

  const renderStars = (rating, outfitId) => {
    return (
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star-btn ${star <= rating ? 'star-active' : ''}`}
            onClick={() => handleRateOutfit(outfitId, star)}
            disabled={isRatingOutfit && ratingOutfitId === outfitId}
          >
            {isRatingOutfit && ratingOutfitId === outfitId ? (
              <Loader2 size={16} className="animate-spin" />
            ) : star <= rating ? (
              <Star size={16} fill="currentColor" />
            ) : (
              <StarOff size={16} />
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="page-content">
      {/* Profile Section */}
      <div className="profile-section">
        <div className="profile-card">
          <div className="profile-header">
            <h1 className="page-title">Groups</h1>
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

      <div className="groups-container">
        {/* Groups List */}
        <div className="card groups-list-card">
          <div className="card-header">
            <Users className="icon-primary" size={24} />
            <h2>My Groups</h2>
          </div>
          
          <div className="group-actions">
            <button className="btn btn-primary" onClick={() => {
              setShowCreateGroupForm(!showCreateGroupForm);
              setShowJoinGroupForm(false);
            }}>
              {showCreateGroupForm ? "Cancel" : "Create Group"}
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setShowJoinGroupForm(!showJoinGroupForm);
              setShowCreateGroupForm(false);
            }}>
              {showJoinGroupForm ? "Cancel" : "Join Group"}
            </button>
          </div>

          {showCreateGroupForm && (
            <form className="add-group-form" onSubmit={handleCreateGroup}>
              <input
                type="text"
                placeholder="Group Name"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Group Description (Optional)"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                rows={3}
              />
              <button type="submit" className="btn btn-primary" disabled={isCreatingGroup}>
                {isCreatingGroup ? "Creating..." : "Create Group"}
              </button>
            </form>
          )}

          {showJoinGroupForm && (
            <form className="join-group-form" onSubmit={handleJoinGroup}>
              <input
                type="text"
                placeholder="Enter Invite Code"
                value={joinGroupData.invite_code}
                onChange={(e) => setJoinGroupData({ ...joinGroupData, invite_code: e.target.value })}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={isJoiningGroup}>
                {isJoiningGroup ? "Joining..." : "Join Group"}
              </button>
            </form>
          )}

          <div className="groups-list" style={{ marginTop: '1.5rem' }}>
            {groupsLoading ? (
              <p>Loading groups...</p>
            ) : groups.length === 0 ? (
              <p>You haven't joined any groups yet. Create a new group or join an existing one with an invite code.</p>
            ) : (
              groups.map((group) => (
                <div 
                  key={group.id} 
                  className={`group-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                  onClick={() => fetchGroupDetails(group.id)}
                >
                  <div className="group-info">
                    <h3 className="group-name">{group.name}</h3>
                    <p className="group-meta">
                      Created by {group.creator_name} • {group.members_count} members
                    </p>
                    {group.description && (
                      <p className="group-description">{group.description}</p>
                    )}
                  </div>
                  <div className="group-actions">
                    <button 
                      className="btn-icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(group.invite_code);
                        toast.success("Invite code copied to clipboard!");
                      }}
                      title="Copy invite code"
                    >
                      {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Group Details */}
        {selectedGroup && (
          <div className="card group-details-card">
            <div className="card-header">
              <Users className="icon-primary" size={24} />
              <h2>{selectedGroup.name}</h2>
            </div>
            
            {groupDetailsLoading ? (
              <p>Loading group details...</p>
            ) : (
              <>
                <div className="group-info-section">
                  <div className="group-details-header">
                    <div>
                      <h3>{groupDetails.name}</h3>
                      <p className="group-meta">
                        Created by {groupDetails.creator_name} • {groupDetails.members.length} members
                      </p>
                      {groupDetails.description && (
                        <p className="group-description">{groupDetails.description}</p>
                      )}
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowShareOutfitForm(true);
                        fetchUserOutfits();
                      }}
                    >
                      <Share2 size={16} style={{ marginRight: '0.5rem' }} />
                      Share Outfit
                    </button>
                  </div>
                  
                  <div className="group-members">
                    <h4>Members</h4>
                    <div className="members-list">
                      {groupDetails.members.map((member) => (
                        <div key={member.id} className="member-item">
                          {member.profile_pic_url ? (
                            <img 
                              src={member.profile_pic_url.startsWith('http') 
                                ? member.profile_pic_url 
                                : `${API_BASE_URL}${member.profile_pic_url}`} 
                              alt={member.username} 
                              className="member-avatar"
                            />
                          ) : (
                            <div className="member-avatar-placeholder">
                              <User size={16} />
                            </div>
                          )}
                          <span className="member-name">{member.username}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="shared-outfits-section">
                  <h4>Shared Outfits</h4>
                  {groupDetails.shared_outfits.length === 0 ? (
                    <p>No outfits shared in this group yet.</p>
                  ) : (
                    <div className="shared-outfits-list">
                      {groupDetails.shared_outfits.map((outfit) => (
                        <div key={outfit.id} className="shared-outfit-item">
                          <div className="outfit-visual">
                            {outfit.image_url ? (
                              <img 
                                src={outfit.image_url.startsWith('http') 
                                  ? outfit.image_url 
                                  : `${API_BASE_URL}${outfit.image_url}`} 
                                alt={outfit.name} 
                                className="outfit-thumbnail"
                              />
                            ) : (
                              <div className="outfit-color" style={{ backgroundColor: outfit.color }}></div>
                            )}
                          </div>
                          <div className="outfit-info">
                            <h3 className="outfit-name">{outfit.name}</h3>
                            <p className="outfit-category">{outfit.category} • {outfit.season} • {outfit.color}</p>
                            <p className="outfit-shared-by">Shared by {outfit.shared_by.username}</p>
                          </div>
                          <div className="outfit-rating">
                            <div className="rating-info">
                              <span className="average-rating">
                                {outfit.average_rating > 0 ? `${outfit.average_rating}/5` : 'Not rated'}
                              </span>
                              <span className="ratings-count">
                                ({outfit.ratings_count} {outfit.ratings_count === 1 ? 'rating' : 'ratings'})
                              </span>
                            </div>
                            <div className="user-rating">
                              <p>Your Rating:</p>
                              {renderStars(outfit.user_rating || 0, outfit.id)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Share Outfit Modal */}
      {showShareOutfitForm && (
        <div className="modal-overlay" onClick={() => setShowShareOutfitForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share Outfit to {selectedGroup?.name}</h2>
              <button className="btn-close" onClick={() => setShowShareOutfitForm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {userOutfitsLoading ? (
                <p>Loading your outfits...</p>
              ) : (
                <form onSubmit={handleShareOutfit}>
                  <div className="outfit-selection">
                    {userOutfits.length === 0 ? (
                      <p>You don't have any outfits to share. Add some outfits to your wardrobe first.</p>
                    ) : (
                      <>
                        <label htmlFor="outfit-select">Select an outfit to share:</label>
                        <select
                          id="outfit-select"
                          value={shareOutfitData.outfit_id}
                          onChange={(e) => setShareOutfitData({ ...shareOutfitData, outfit_id: e.target.value })}
                          required
                        >
                          <option value="">-- Select an outfit --</option>
                          {userOutfits.map((outfit) => (
                            <option key={outfit.id} value={outfit.id}>
                              {outfit.name} ({outfit.category}, {outfit.color})
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={resetShareOutfitForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSharingOutfit || userOutfits.length === 0}>
                      {isSharingOutfit ? "Sharing..." : "Share Outfit"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom styles for the groups page */}
      <style jsx>{`
        .groups-container {
          display: flex;
          gap: 1.5rem;
        }
        
        .groups-list-card {
          flex: 1;
          max-width: 400px;
        }
        
        .group-details-card {
          flex: 2;
        }
        
        .group-actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .add-group-form, .join-group-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 6px;
        }
        
        .group-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .group-item:hover {
          background-color: #f8f9fa;
        }
        
        .group-item.active {
          background-color: #e6f7ff;
          border-left: 3px solid #1890ff;
        }
        
        .group-name {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
        }
        
        .group-meta {
          font-size: 0.875rem;
          color: #666;
          margin: 0 0 0.5rem 0;
        }
        
        .group-description {
          font-size: 0.875rem;
          color: #333;
          margin: 0;
        }
        
        .group-info-section {
          margin-bottom: 1.5rem;
        }
        
        .group-details-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .group-members h4 {
          margin: 0 0 0.75rem 0;
          font-size: 1.1rem;
        }
        
        .members-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        
        .member-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background-color: #f8f9fa;
          border-radius: 20px;
        }
        
        .member-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .member-avatar-placeholder {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }
        
        .member-name {
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .shared-outfits-section h4 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
        }
        
        .shared-outfits-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .shared-outfit-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        
        .outfit-visual {
          flex-shrink: 0;
        }
        
        .outfit-thumbnail {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 4px;
        }
        
        .outfit-color {
          width: 80px;
          height: 80px;
          border-radius: 4px;
        }
        
        .outfit-info {
          flex: 1;
        }
        
        .outfit-name {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
        }
        
        .outfit-category {
          font-size: 0.875rem;
          color: #666;
          margin: 0 0 0.25rem 0;
        }
        
        .outfit-shared-by {
          font-size: 0.875rem;
          color: #4a5568;
          margin: 0;
        }
        
        .outfit-rating {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          min-width: 150px;
        }
        
        .rating-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        
        .average-rating {
          font-weight: 600;
          font-size: 1rem;
        }
        
        .ratings-count {
          font-size: 0.75rem;
          color: #666;
        }
        
        .user-rating {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }
        
        .user-rating p {
          font-size: 0.75rem;
          margin: 0;
        }
        
        .rating-stars {
          display: flex;
          gap: 0.25rem;
        }
        
        .star-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #d1d5db;
          transition: color 0.2s ease;
        }
        
        .star-btn:hover {
          color: #fbbf24;
        }
        
        .star-btn.star-active {
          color: #fbbf24;
        }
        
        .outfit-selection {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .outfit-selection label {
          font-weight: 500;
        }
        
        .outfit-selection select {
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        
        @media (max-width: 768px) {
          .groups-container {
            flex-direction: column;
          }
          
          .groups-list-card {
            max-width: 100%;
          }
          
          .shared-outfit-item {
            flex-direction: column;
          }
          
          .outfit-rating {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default GroupsPage;