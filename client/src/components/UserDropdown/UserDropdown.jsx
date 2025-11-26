import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useAdmin } from '../../contexts/AdminContext';
import './UserDropdown.css';

const UserDropdown = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { userLogout } = useUser();
  const { isAdmin, adminLogout } = useAdmin();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    if (isAdmin) {
      adminLogout();
    }
    userLogout();
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <div className="user-avatar" onClick={toggleDropdown}>
        <img 
          className="topImg"
          src={user.avatar || "https://lh3.googleusercontent.com/a/ACg8ocKyzBlZ6G6WI8BZQpstO_hcA3hhfSuyesOerch4wMn0ISfAXY8v=s96-c"}
          alt={user.name || user.username}
        />
        <i className={`dropdown-arrow fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            <img 
              src={user.avatar || "https://lh3.googleusercontent.com/a/ACg8ocKyzBlZ6G6WI8BZQpstO_hcA3hhfSuyesOerch4wMn0ISfAXY8v=s96-c"}
              alt={user.name || user.username}
              className="dropdown-avatar"
            />
            <div className="user-info">
              <h4>{user.name || `${user.firstName} ${user.lastName}`}</h4>
              <p>{user.email}</p>
              <span className="user-role">{user.role || 'User'}</span>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-section">
            <h5>Quick Access</h5>
            
            {(user.role === 'writer' || user.role === 'author' || user.role === 'editor' || user.role === 'admin' || user.role === 'super_admin') && (
              <Link to="/write" className="dropdown-item" onClick={() => setIsOpen(false)}>
                <i className="fa-solid fa-pen"></i>
                Write New Post
              </Link>
            )}

            <Link to="/settings" className="dropdown-item" onClick={() => setIsOpen(false)}>
              <i className="fa-solid fa-user-gear"></i>
              Profile Settings
            </Link>

            {user.role === 'reader' && (
              <Link to="/bookmarks" className="dropdown-item" onClick={() => setIsOpen(false)}>
                <i className="fa-solid fa-bookmark"></i>
                My Bookmarks
              </Link>
            )}
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-section">
            <h5>Admin Tools</h5>
            
            {(user.role === 'admin' || user.role === 'super_admin') && (
              <Link to="/ops" className="dropdown-item admin-item" onClick={() => setIsOpen(false)}>
                <i className="fa-solid fa-shield-halved"></i>
                Operations Center
              </Link>
            )}

            <Link to="/adminlogin" className="dropdown-item admin-item" onClick={() => setIsOpen(false)}>
              <i className="fa-solid fa-key"></i>
              Admin Login
            </Link>
          </div>

          <div className="dropdown-divider"></div>

          <button className="dropdown-item logout-item" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket"></i>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
