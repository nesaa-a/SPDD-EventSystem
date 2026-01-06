import { useState, useEffect } from 'react';
import { participantsAPI } from '../services/api';

const ParticipantList = ({ eventId }) => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const data = await participantsAPI.getByEventId(eventId);
      setParticipants(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error loading participants');
      console.error('Error fetching participants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchParticipants();
    }
  }, [eventId]);

  const handleRemove = async (participantId) => {
    if (!window.confirm('Are you sure you want to remove this participant?')) {
      return;
    }

    try {
      await participantsAPI.remove(eventId, participantId);
      fetchParticipants();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Error removing participant');
    }
  };

  if (loading) {
    return <div className="loading-small">Loading participants...</div>;
  }

  if (error) {
    return (
      <div className="error-container-small">
        <p className="error-message">{error}</p>
        <button onClick={fetchParticipants} className="btn btn-small">
          Try Again
        </button>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="empty-state-small">
        <p>No participants registered for this event.</p>
      </div>
    );
  }

  return (
    <div className="participant-list">
      <div className="participant-list-header">
        <h4>Participants ({participants.length})</h4>
        <button onClick={fetchParticipants} className="btn btn-link btn-small">
          Refresh
        </button>
      </div>
      <ul className="participant-items">
        {participants.map(participant => (
          <li key={participant.id} className="participant-item">
            <div className="participant-info">
              <strong>{participant.name}</strong>
              <span className="participant-email">{participant.email}</span>
              {participant.phone && (
                <span className="participant-phone">{participant.phone}</span>
              )}
            </div>
            <button
              onClick={() => handleRemove(participant.id)}
              className="btn btn-small btn-danger"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantList;

