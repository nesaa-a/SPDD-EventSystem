import { useState, useEffect } from 'react';
import { eventsAPI } from '../services/api';

const EventForm = ({ onEventCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    seats: '',
    organizer: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await eventsAPI.getCategories();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

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
        category: '',
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

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        <div style={gridStyle}>
          <div>
            <label htmlFor="title" style={labelStyle}>Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Enter event title"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="category" style={labelStyle}>Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" style={labelStyle}>Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            placeholder="Event description"
            style={{...inputStyle, resize: 'none'}}
          />
        </div>

        <div style={gridStyle}>
          <div>
            <label htmlFor="organizer" style={labelStyle}>Organizer/Speaker</label>
            <input
              type="text"
              id="organizer"
              name="organizer"
              value={formData.organizer}
              onChange={handleChange}
              placeholder="Name of organizer or speaker"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="location" style={labelStyle}>Location *</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              placeholder="Event location"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={gridStyle}>
          <div>
            <label htmlFor="date" style={labelStyle}>Date & Time *</label>
            <input
              type="datetime-local"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="seats" style={labelStyle}>Number of Seats *</label>
            <input
              type="number"
              id="seats"
              name="seats"
              value={formData.seats}
              onChange={handleChange}
              required
              min="1"
              placeholder="Available seats"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '14px'}}>
            {error}
          </div>
        )}
        {success && (
          <div style={{padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', fontSize: '14px'}}>
            Event created successfully!
          </div>
        )}

        <div style={{display: 'flex', gap: '12px'}}>
          <button 
            type="submit" 
            disabled={loading} 
            style={{
              padding: '12px 24px',
              backgroundColor: '#2563eb',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel} 
              style={{
                padding: '12px 24px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default EventForm;

