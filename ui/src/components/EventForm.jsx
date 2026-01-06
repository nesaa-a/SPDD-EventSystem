import { useState } from 'react';
import { eventsAPI } from '../services/api';

const EventForm = ({ onEventCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    seats: '',
    organizer: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'seats' ? parseInt(value) || '' : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate required fields
      if (!formData.title || !formData.location || !formData.date || !formData.seats) {
        throw new Error('Please fill in all required fields');
      }

      await eventsAPI.create(formData);
      setSuccess(true);
      setFormData({
        title: '',
        description: '',
        location: '',
        date: '',
        seats: '',
        organizer: '',
      });
      
      if (onEventCreated) {
        onEventCreated();
      }
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error creating event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-form-container">
      <h2>Create New Event</h2>
      <form onSubmit={handleSubmit} className="event-form">
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Enter event title"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="4"
            placeholder="Event description"
          />
        </div>

        <div className="form-group">
          <label htmlFor="organizer">Organizer/Speaker</label>
          <input
            type="text"
            id="organizer"
            name="organizer"
            value={formData.organizer}
            onChange={handleChange}
            placeholder="Name of organizer or speaker"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="location">Location *</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              placeholder="Event location"
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Date & Time *</label>
            <input
              type="datetime-local"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="seats">Number of Seats *</label>
          <input
            type="number"
            id="seats"
            name="seats"
            value={formData.seats}
            onChange={handleChange}
            required
            min="1"
            placeholder="Available seats"
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Event created successfully!</div>}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default EventForm;

