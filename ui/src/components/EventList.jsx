import { useState, useEffect } from 'react';
import { eventsAPI } from '../services/api';
import EventCard from './EventCard';
import UserEventCard from './UserEventCard';

const EventList = ({ refreshTrigger, userRole, currentUserEmail }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await eventsAPI.getAll();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error loading events');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [refreshTrigger]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await eventsAPI.delete(id);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Error deleting event');
    }
  };

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={fetchEvents} className="btn btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <p>No events available. Create a new event to get started!</p>
      </div>
    );
  }

  return (
    <div className="event-list">
      <div className="event-list-header">
        <h2>Events List</h2>
        <button onClick={fetchEvents} className="btn btn-secondary">
          Refresh
        </button>
      </div>
      <div className="events-grid">
        {events.map(event => (
          userRole === 'admin' ? (
            <EventCard
              key={event.id}
              event={event}
              onUpdate={fetchEvents}
              onDelete={handleDelete}
              userRole={userRole}
            />
          ) : (
            <UserEventCard
              key={event.id}
              event={event}
              onUpdate={fetchEvents}
              currentUserEmail={currentUserEmail}
            />
          )
        ))}
      </div>
    </div>
  );
};

export default EventList;

