import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api.js';

export const useSocialLinks = () => {
  const [socialLinks, setSocialLinks] = useState({
    linkedin: '',
    twitter: '',
    instagram: '',
    threads: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.SETTINGS.SOCIAL);
        if (response.ok) {
          const data = await response.json();
          setSocialLinks(data);
        } else {
          console.error('Failed to fetch social links:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching social links:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSocialLinks();
  }, []);

  return { socialLinks, loading };
};
