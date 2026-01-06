import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI, participantsAPI } from '../services/api';

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
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const eventsData = await eventsAPI.getAll();
      setEvents(eventsData);

      // Calculate statistics
      let totalParticipants = 0;
      let upcomingEvents = 0;
      let fullEvents = 0;
      const now = new Date();

      for (const event of eventsData) {
        try {
          const participants = await participantsAPI.getByEventId(event.id);
          totalParticipants += participants.length;
          
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
        totalParticipants,
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
      <div className="app">
        <div className="loading">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>👑 Admin Dashboard</h1>
            <p>Welcome, {user?.name || 'Admin'}! Manage all events and participants</p>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
              User View
            </button>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <h3>{stats.totalEvents}</h3>
              <p>Total Events</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>{stats.totalParticipants}</h3>
              <p>Total Participants</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏰</div>
            <div className="stat-content">
              <h3>{stats.upcomingEvents}</h3>
              <p>Upcoming Events</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔒</div>
            <div className="stat-content">
              <h3>{stats.fullEvents}</h3>
              <p>Full Events</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchData} className="btn btn-primary">
              Retry
            </button>
          </div>
        )}

        {/* Events Management */}
        <div className="admin-section">
          <div className="section-header">
            <h2>All Events Management</h2>
            <button onClick={fetchData} className="btn btn-secondary">
              Refresh
            </button>
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              <p>No events found. Create events from the user dashboard.</p>
            </div>
          ) : (
            <div className="admin-events-list">
              {events.map(event => (
                <div key={event.id} className="admin-event-card">
                  <div className="admin-event-header">
                    <h3>{event.title}</h3>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="btn btn-small btn-danger"
                    >
                      Delete Event
                    </button>
                  </div>
                  <div className="admin-event-details">
                    <p><strong>Location:</strong> {event.location}</p>
                    <p><strong>Date:</strong> {new Date(event.date).toLocaleString()}</p>
                    <p><strong>Seats:</strong> {event.seats}</p>
                    {event.description && <p><strong>Description:</strong> {event.description}</p>}
                  </div>
                  <div className="admin-event-actions">
                    <button
                      onClick={() => navigate(`/admin/event/${event.id}`)}
                      className="btn btn-small btn-primary"
                    >
                      View Participants
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2024 Event Management System - Admin Panel</p>
      </footer>
    </div>
  );
};

export default AdminDashboard;

