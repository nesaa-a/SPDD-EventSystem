import { useState, useEffect } from 'react';
import { participantsAPI } from '../services/api';

const ParticipantForm = ({ eventId, onParticipantRegistered }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch (err) {
        console.error('Error parsing user data in ParticipantForm:', err);
      }
    }
  }, []);

  const [formData, setFormData] = useState({
    name: currentUser?.username || '',
    email: currentUser?.email || '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setFormData({
      name: currentUser?.username || '',
      email: currentUser?.email || '',
      phone: '',
    });
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!formData.name || !formData.email) {
        throw new Error('Name and email are required');
      }

      await participantsAPI.register(eventId, formData);
      setSuccess(true);
      setFormData({
        name: currentUser?.username || '',
        email: currentUser?.email || '',
        phone: '',
      });
      
      if (onParticipantRegistered) {
        setTimeout(() => {
          onParticipantRegistered();
        }, 1000);
      }
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error registering participant');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '4px'
  };

  return (
    <div>
      <h4 style={{fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '16px'}}>Register New Participant</h4>
      <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
        <div>
          <label htmlFor="name" style={labelStyle}>Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Full name"
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="email" style={labelStyle}>Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="email@example.com"
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="phone" style={labelStyle}>Phone</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (555) 123-4567"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '14px'}}>
            {error}
          </div>
        )}
        {success && (
          <div style={{padding: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#16a34a', fontSize: '14px'}}>
            Participant registered successfully!
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '6px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: loading ? 0.5 : 1,
            alignSelf: 'flex-start'
          }}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default ParticipantForm;

