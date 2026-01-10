import { useState, useEffect } from 'react';
import { eventsAPI } from '../services/api';
import EventCard from './EventCard';
import UserEventCard from './UserEventCard';

const EventList = ({ refreshTrigger, userRole, searchResults }) => {
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

  // Use search results if available, otherwise use fetched events
  const displayEvents = searchResults !== null ? searchResults : events;

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

  if (loading && searchResults === null) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading events...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 mb-4">{error}</p>
        <button onClick={fetchEvents} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Try Again
        </button>
      </div>
    );
  }

  if (displayEvents.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600 text-lg">
          {searchResults !== null 
            ? 'No events found matching your search criteria.' 
            : 'No events available. Create a new event to get started!'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2 style={{fontSize: '1.25rem', fontWeight: '600', color: '#1f2937'}}>
          {searchResults !== null 
            ? `Found ${displayEvents.length} event${displayEvents.length !== 1 ? 's' : ''}`
            : `All Events (${displayEvents.length})`}
        </h2>
        <button 
          onClick={fetchEvents} 
          style={{padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}
        >
          🔄 Refresh
        </button>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px'}}>
        {displayEvents.map(event => (
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
            />
          )
        ))}
      </div>
    </div>
  );
};

export default EventList;

