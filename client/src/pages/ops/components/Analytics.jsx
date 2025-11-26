import React, { useState, useEffect } from 'react';
import { API_URL } from '../../../config/api';
import axios from 'axios';

export default function Analytics() {
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalViews: 0,
    thisMonthViews: 0,
    totalComments: 0,
    totalLikes: 0,
    loading: true,
    error: null
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_URL}/api/analytics/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setStats({
          ...response.data.stats,
          loading: false,
          error: null
        });
      } else {
        setStats(prev => ({ ...prev, loading: false, error: 'Failed to load analytics' }));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setStats(prev => ({ ...prev, loading: false, error: 'Failed to load analytics' }));
    }
  };

  if (stats.loading) {
    return (
      <div className="analytics">
        <h2>Analytics Dashboard</h2>
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="analytics">
        <h2>Analytics Dashboard</h2>
        <div className="error">
          <p>{stats.error}</p>
          <button onClick={fetchAnalytics}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics">
      <h2>Analytics Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Posts</h3>
          <p className="stat-number">{stats.totalPosts}</p>
        </div>
        <div className="stat-card">
          <h3>Total Views</h3>
          <p className="stat-number">{stats.totalViews.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>This Month Views</h3>
          <p className="stat-number">{stats.thisMonthViews.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Total Comments</h3>
          <p className="stat-number">{stats.totalComments}</p>
        </div>
        <div className="stat-card">
          <h3>Total Likes</h3>
          <p className="stat-number">{stats.totalLikes}</p>
        </div>
      </div>
    </div>
  );
}
