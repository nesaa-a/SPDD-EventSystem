import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, participantsAPI } from '../services/api';

const AdminEventDetail = ({ user, onLogout }) => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      const eventData = await eventsAPI.getById(parseInt(eventId));
      setEvent(eventData);

      const participantsData = await participantsAPI.getByEventId(parseInt(eventId));
      setParticipants(participantsData);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error loading event');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!window.confirm('Are you sure you want to remove this participant?')) {
      return;
    }

    try {
      await participantsAPI.remove(parseInt(eventId), participantId);
      fetchEventData();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Error removing participant');
    }
  };

  if (loading) {
    return <div className="loading">Loading event details...</div>;
  }

  if (error || !event) {
    return (
      <div className="error-container">
        <p className="error-message">{error || 'Event not found'}</p>
        <button onClick={() => navigate('/admin')} className="btn btn-primary">
          Back to Admin Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Event Participants</h1>
            <p>{event.title}</p>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate('/admin')} className="btn btn-secondary">
              Back to Dashboard
            </button>
            <button onClick={onLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="event-info-card">
          <h2>{event.title}</h2>
          <div className="event-meta">
            <p><strong>Location:</strong> {event.location}</p>
            <p><strong>Date:</strong> {new Date(event.date).toLocaleString()}</p>
            <p><strong>Total Seats:</strong> {event.seats}</p>
            <p><strong>Registered:</strong> {participants.length} / {event.seats}</p>
            <p><strong>Available:</strong> {event.seats - participants.length}</p>
          </div>
        </div>

        <div className="participants-section">
          <div className="section-header">
            <h2>Participants ({participants.length})</h2>
            <button onClick={fetchEventData} className="btn btn-secondary">
              Refresh
            </button>
          </div>

          {participants.length === 0 ? (
            <div className="empty-state">
              <p>No participants registered for this event yet.</p>
            </div>
          ) : (
            <div className="participants-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(participant => (
                    <tr key={participant.id}>
                      <td>{participant.name}</td>
                      <td>{participant.email}</td>
                      <td>{participant.phone || 'N/A'}</td>
                      <td>
                        <button
                          onClick={() => handleRemoveParticipant(participant.id)}
                          className="btn btn-small btn-danger"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminEventDetail;

