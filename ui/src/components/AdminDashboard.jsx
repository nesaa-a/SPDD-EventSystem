import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI, participantsAPI, reportingAPI } from '../services/api';
import EventForm from './EventForm';

const AdminDashboard = ({ user, onLogout }) => {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalParticipants: 0,
    upcomingEvents: 0,
    fullEvents: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsData, reportData] = await Promise.all([
        eventsAPI.getAll(),
        reportingAPI.getStats()
      ]);
      setEvents(eventsData);

      // Use reporting data
      setStats(prev => ({
        ...prev,
        totalEvents: reportData.total_events,
        totalParticipants: reportData.total_participants,
        eventsWithParticipants: reportData.events_with_participants
      }));

      // Calculate additional statistics
      let upcomingEvents = 0;
      let fullEvents = 0;
      let totalParticipantsCount = reportData.total_participants || 0;
      const now = new Date();

      for (const event of eventsData) {
        try {
          const participants = await participantsAPI.getByEventId(event.id);
          
          const eventDate = new Date(event.date);
          if (eventDate > now) {
            upcomingEvents++;
          }
          
          if (participants.length >= event.seats) {
            fullEvents++;
          }
        } catch (err) {
          console.error(`Error fetching participants for event ${event.id}:`, err);
        }
      }

      setStats({
        totalEvents: eventsData.length,
        totalParticipants: totalParticipantsCount,
        upcomingEvents,
        fullEvents
      });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event? This will also delete all participants.')) {
      return;
    }

    try {
      await eventsAPI.delete(eventId);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Error deleting event');
    }
  };

  if (loading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px'}}>
        <div>Loading admin dashboard...</div>
      </div>
    );
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '24px',
    border: '1px solid #e5e7eb',
    marginBottom: '24px'
  };

  return (
    <div>
      {/* Statistics Cards */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px'}}>
        <div style={{background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px', padding: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <span style={{fontSize: '2rem'}}>📅</span>
          <div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold'}}>{stats.totalEvents}</div>
            <div style={{opacity: 0.9, fontSize: '14px'}}>Total Events</div>
          </div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '12px', padding: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <span style={{fontSize: '2rem'}}>👥</span>
          <div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold'}}>{stats.totalParticipants}</div>
            <div style={{opacity: 0.9, fontSize: '14px'}}>Total Participants</div>
          </div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '12px', padding: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <span style={{fontSize: '2rem'}}>⏰</span>
          <div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold'}}>{stats.upcomingEvents}</div>
            <div style={{opacity: 0.9, fontSize: '14px'}}>Upcoming Events</div>
          </div>
        </div>
        <div style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderRadius: '12px', padding: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <span style={{fontSize: '2rem'}}>🔒</span>
          <div>
            <div style={{fontSize: '1.75rem', fontWeight: 'bold'}}>{stats.fullEvents}</div>
            <div style={{opacity: 0.9, fontSize: '14px'}}>Full Events</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '24px'}}>
          <p style={{color: '#b91c1c', marginBottom: '12px'}}>{error}</p>
          <button onClick={fetchData} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer'}}>
            Retry
          </button>
        </div>
      )}

      {/* Create Event Section */}
      <div style={cardStyle}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showEventForm ? '20px' : '0'}}>
          <h2 style={{fontSize: '1.25rem', fontWeight: '600', color: '#1f2937'}}>Create New Event</h2>
          <button 
            onClick={() => setShowEventForm(!showEventForm)} 
            style={{padding: '10px 20px', backgroundColor: showEventForm ? '#6b7280' : '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500'}}
          >
            {showEventForm ? '✕ Cancel' : '+ New Event'}
          </button>
        </div>
        {showEventForm && (
          <EventForm 
            onEventCreated={() => {
              setShowEventForm(false);
              fetchData();
            }}
            onCancel={() => setShowEventForm(false)}
          />
        )}
      </div>

      {/* Events Management */}
      <div style={cardStyle}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{fontSize: '1.25rem', fontWeight: '600', color: '#1f2937'}}>All Events ({events.length})</h2>
          <button onClick={fetchData} style={{padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '6px', border: 'none', cursor: 'pointer'}}>
            🔄 Refresh
          </button>
        </div>

        {events.length === 0 ? (
          <div style={{backgroundColor: '#f9fafb', borderRadius: '8px', padding: '32px', textAlign: 'center', color: '#6b7280'}}>
            No events found. Create your first event above!
          </div>
        ) : (
          <div style={{display: 'grid', gap: '16px'}}>
            {events.map(event => (
              <div key={event.id} style={{backgroundColor: '#f9fafb', borderRadius: '10px', padding: '20px', border: '1px solid #e5e7eb'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '12px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <h3 style={{fontSize: '1.125rem', fontWeight: '600', color: '#111827'}}>{event.title}</h3>
                    {event.category && (
                      <span style={{padding: '4px 10px', fontSize: '12px', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '9999px'}}>
                        {event.category}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    style={{padding: '6px 12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px'}}
                  >
                    🗑️ Delete
                  </button>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', fontSize: '14px', color: '#4b5563', marginBottom: '16px'}}>
                  <p>📍 {event.location}</p>
                  <p>📅 {new Date(event.date).toLocaleDateString()}</p>
                  <p>🪑 {event.seats} seats</p>
                </div>
                {event.description && <p style={{fontSize: '14px', color: '#6b7280', marginBottom: '16px'}}>{event.description}</p>}
                <button
                  onClick={() => navigate(`/admin/event/${event.id}`)}
                  style={{padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500'}}
                >
                  👥 View Participants
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

