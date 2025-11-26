import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../../config/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState('');
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      console.log('Fetching users with token:', token ? 'Token exists' : 'No token found');
      console.log('API URL:', API_ENDPOINTS.ADMIN.USERS);
      
      if (!token) {
        setMessage('Authentication required. Please login again.');
        setLoading(false);
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.ADMIN.USERS, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Users data received:', data);
        setUsers(data.users || data);
        setMessage(''); // Clear any previous error messages
      } else if (response.status === 401) {
        setMessage('Session expired. Please login again.');
        localStorage.removeItem('adminToken');
        // Optionally redirect to login
      } else {
        const errorData = await response.text();
        console.log('Error response:', errorData);
        setMessage(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setMessage('Authentication required. Please login again.');
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.ADMIN.USERS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();

      if (response.ok) {
        setUsers([...users, data.user]);
        setNewUser({
          username: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'user'
        });
        setShowAddForm(false);
        setMessage('User created successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.message || `Error creating user: ${response.status}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage('Error creating user: ' + error.message);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(API_ENDPOINTS.ADMIN.USER(userId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(users.map(user => user.id === userId ? data.user : user));
        setEditingUser(null);
        setMessage('User updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.message || 'Error updating user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setMessage('Error updating user');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(API_ENDPOINTS.ADMIN.USER(userId), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (response.ok) {
          setUsers(users.filter(user => user.id !== userId));
          setMessage('User deleted successfully!');
          setTimeout(() => setMessage(''), 3000);
        } else {
          setMessage(data.message || 'Error deleting user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setMessage('Error deleting user');
      }
    }
  };

  const getUserRoleColor = (role) => {
    switch (role) {
      case 'super_admin': return '#e74c3c';
      case 'admin': return '#e67e22';
      case 'editor': return '#f39c12';
      case 'author': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const formatUserRole = (role) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'editor': return 'Editor';
      case 'author': return 'Author/Writer';
      default: return 'User';
    }
  };

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="section-header">
        <h2>User Management</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <i className="fa-solid fa-user-plus"></i> Add User
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {showAddForm && (
        <div className="add-user-form">
          <form onSubmit={handleAddUser}>
            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="Enter username"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="Enter email"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input 
                  type="text" 
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                  placeholder="Enter first name"
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input 
                  type="text" 
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                  placeholder="Enter last name"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Enter password"
                  minLength="8"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="author">Author/Writer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create User
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="users-grid">
        {users.map(user => (
          <div key={user.id} className="user-card">
            <div className="user-avatar">
              <i className="fa-solid fa-user"></i>
            </div>
            <div className="user-info">
              <h3>{user.first_name && user.last_name ? 
                `${user.first_name} ${user.last_name}` : 
                user.username}
              </h3>
              <p className="user-username">@{user.username}</p>
              <p className="user-email">{user.email}</p>
              <span 
                className="user-role" 
                style={{ backgroundColor: getUserRoleColor(user.role) }}
              >
                {formatUserRole(user.role)}
              </span>
              <p className="user-status">
                <i className={`fa-solid fa-circle ${user.is_active ? 'active' : 'inactive'}`}></i>
                {user.is_active ? 'Active' : 'Inactive'}
              </p>
              <p className="user-date">
                Joined: {new Date(user.created_at).toLocaleDateString()}
              </p>
              {user.last_login_at && (
                <p className="user-last-login">
                  Last login: {new Date(user.last_login_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="user-actions">
              <button 
                className="btn-secondary"
                onClick={() => setEditingUser(user)}
              >
                <i className="fa-solid fa-edit"></i> Edit
              </button>
              <button 
                className="btn-danger"
                onClick={() => handleDeleteUser(user.id, user.username)}
              >
                <i className="fa-solid fa-trash"></i> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="no-users">
          <i className="fa-solid fa-users"></i>
          <h3>No users found</h3>
          <p>Create your first user by clicking the "Add User" button above.</p>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User: {editingUser.username}</h3>
              <button className="modal-close" onClick={() => setEditingUser(null)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                role: formData.get('role'),
                isActive: formData.get('isActive') === 'on'
              };
              if (formData.get('password')) {
                updates.password = formData.get('password');
              }
              handleUpdateUser(editingUser.id, updates);
            }}>
              <div className="form-group">
                <label>First Name</label>
                <input 
                  name="firstName"
                  type="text" 
                  defaultValue={editingUser.first_name || ''}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input 
                  name="lastName"
                  type="text" 
                  defaultValue={editingUser.last_name || ''}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  name="email"
                  type="email" 
                  defaultValue={editingUser.email}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" defaultValue={editingUser.role}>
                  <option value="user">User</option>
                  <option value="author">Author/Writer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input 
                    name="isActive"
                    type="checkbox" 
                    defaultChecked={editingUser.is_active}
                  />
                  Active User
                </label>
              </div>
              <div className="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input 
                  name="password"
                  type="password" 
                  placeholder="Enter new password"
                  minLength="8"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Update User
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
