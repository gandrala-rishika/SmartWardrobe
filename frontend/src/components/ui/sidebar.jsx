import { NavLink } from "react-router-dom";
import { LayoutDashboard, Shirt, Sparkles, Users, LogOut } from "lucide-react";

const Sidebar = ({ onLogout }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Smart Wardrobe</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="nav-item">
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>
        <NavLink to="/outfits" className="nav-item">
          <Shirt size={20} />
          All Outfits
        </NavLink>
        <NavLink to="/groups" className="nav-item">
          <Users size={20} />
          Groups
        </NavLink>
        <NavLink to="/suggestions" className="nav-item">
          <Sparkles size={20} />
          AI Suggestions
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button onClick={onLogout} className="nav-item logout-btn">
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;