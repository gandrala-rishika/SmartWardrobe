import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { User, Settings, Camera, Save, Eye, EyeOff, Lock, Mail, Phone, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Define your backend server's URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_PROD_BACKEND_URL || "https://smartwardrobe-qrzg.onrender.com"
  : process.env.REACT_APP_DEV_BACKEND_URL || "http://127.0.0.1:8000";

const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const navigate = useNavigate();
  
  const fileInputRef = useRef(null);
  
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    phone: ''
  });
  
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: ''
  });
  
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get("/profile");
      setUserProfile(response.data);
      setEditForm({
        username: response.data.username,
        email: response.data.email,
        phone: response.data.phone || ''
      });
      // Convert relative URL to absolute URL if needed
      if (response.data.profile_pic_url) {
        const imageUrl = response.data.profile_pic_url.startsWith('http') 
          ? response.data.profile_pic_url 
          : `${API_BASE_URL}${response.data.profile_pic_url}`;
        setImagePreview(imageUrl);
      }
    } catch (error) {
      toast.error("Failed to fetch profile data");
    } finally {
      setLoading(false);
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

  const handleProfilePicUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];
    
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post("/profile/upload-pic", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(response.data.message);
      fetchUserProfile(); // Refresh profile data
      // Convert relative URL to absolute URL if needed
      if (response.data.profile_pic_url) {
        const imageUrl = response.data.profile_pic_url.startsWith('http') 
          ? response.data.profile_pic_url 
          : `${API_BASE_URL}${response.data.profile_pic_url}`;
        setImagePreview(imageUrl);
      }
    } catch (error) {
      toast.error("Failed to upload profile picture");
    } finally {
      setUploadingPic(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    
    try {
      const formData = new FormData();
      formData.append('username', editForm.username);
      formData.append('email', editForm.email);
      if (editForm.phone !== undefined) {
        formData.append('phone', editForm.phone);
      }
      
      await axios.put("/profile", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success("Profile updated successfully!");
      fetchUserProfile(); // Refresh profile data
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!passwordForm.current_password || !passwordForm.new_password) {
      toast.error("Please fill in all password fields");
      return;
    }
    
    setChangingPassword(true);
    
    try {
      await axios.post("/profile/change-password", passwordForm);
      toast.success("Password changed successfully!");
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Profile Section */}
      <div className="profile-section">
        <div className="profile-card">
          <div className="profile-header">
            <h1 className="page-title">Profile</h1>
            <div className="profile-info">
              <div 
                className="profile-picture-container" 
                onClick={() => navigate('/dashboard')}
                title="Back to Dashboard"
              >
                {userProfile?.profile_pic_url ? (
                  <img 
                    src={userProfile.profile_pic_url.startsWith('http') 
                      ? userProfile.profile_pic_url 
                      : `${API_BASE_URL}${userProfile.profile_pic_url}`} 
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

      <div className="profile-content">
        {/* Profile Info Card */}
        <div className="profile-info-card">
          <div className="profile-pic-section">
            <form onSubmit={handleProfilePicUpload} className="profile-pic-upload">
              <label htmlFor="profile-pic" className="profile-pic-upload-label">
                {imagePreview ? (
                  <img 
                    src={imagePreview.startsWith('data:') ? imagePreview : imagePreview} 
                    alt="Profile" 
                    className="profile-pic-large"
                  />
                ) : (
                  <div className="profile-pic-large-placeholder">
                    <UserCircle size={60} />
                  </div>
                )}
                <div className="profile-pic-upload-overlay">
                  <Camera size={16} />
                  <span>Upload Photo</span>
                </div>
              </label>
              <input
                id="profile-pic"
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              {imagePreview && imagePreview !== userProfile?.profile_pic_url && (
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={uploadingPic}
                >
                  {uploadingPic ? "Uploading..." : "Save Photo"}
                </button>
              )}
            </form>
          </div>

          <div className="profile-details-section">
            <div className="profile-detail-row">
              <span className="profile-detail-label">Username</span>
              <span className="profile-detail-value">{userProfile?.username}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Email</span>
              <span className="profile-detail-value">{userProfile?.email}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Phone</span>
              <span className="profile-detail-value">{userProfile?.phone || "Not added"}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Gender</span>
              <span className="profile-detail-value" style={{ textTransform: 'capitalize' }}>
                {userProfile?.gender}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Actions Card */}
        <div className="profile-actions-card">
          <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Edit Profile</h2>
          
          {/* Update Profile Form */}
          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                <User size={16} style={{ marginRight: '8px' }} />
                Username
              </label>
              <input
                id="username"
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <Mail size={16} style={{ marginRight: '8px' }} />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                <Phone size={16} style={{ marginRight: '8px' }} />
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Enter your phone number"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary btn-with-icon" 
                disabled={updating}
              >
                {updating ? (
                  <>
                    <div className="loader" style={{ 
                      width: '16px', 
                      height: '16px', 
                      marginRight: '8px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white'
                    }}></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <hr style={{ 
            margin: '2rem 0', 
            border: 'none', 
            borderTop: '1px solid rgba(0, 0, 0, 0.1)' 
          }} />

          {/* Change Password Form */}
          <h3 className="password-section-title">
            <Lock size={20} style={{ marginRight: '8px' }} />
            Change Password
          </h3>
          
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label htmlFor="current_password" className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="current_password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{ 
                    position: 'absolute', 
                    right: '10px', 
                    top: '50%', 
                    transform: 'translateY(-50%)' 
                  }}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="new_password" className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new_password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ 
                    position: 'absolute', 
                    right: '10px', 
                    top: '50%', 
                    transform: 'translateY(-50%)' 
                  }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-secondary btn-with-icon" 
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <>
                    <div className="loader" style={{ 
                      width: '16px', 
                      height: '16px', 
                      marginRight: '8px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white'
                    }}></div>
                    Changing...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Change Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Add custom styles for proper alignment */}
      <style jsx>{`
        .form-label {
          display: flex;
          align-items: center;
          font-weight: 500;
          color: #333;
        }
        
        .password-section-title {
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
          color: #333;
        }
        
        .btn-with-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default Profile;