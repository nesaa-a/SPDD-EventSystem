import { useState } from 'react';
import { participantsAPI } from '../services/api';

const ParticipantForm = ({ eventId, onParticipantRegistered }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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
        name: '',
        email: '',
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

  return (
    <div className="participant-form-container">
      <h4>Register New Participant</h4>
      <form onSubmit={handleSubmit} className="participant-form">
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Full name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="email@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Participant registered successfully!</div>}

        <button type="submit" disabled={loading} className="btn btn-primary btn-small">
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default ParticipantForm;

