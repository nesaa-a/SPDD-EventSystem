import { useState, useEffect } from 'react';
import ParticipantForm from './ParticipantForm';
import { participantsAPI } from '../services/api';

const UserEventCard = ({ event, onUpdate, currentUserEmail }) => {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkRegistration();
  }, [event.id, currentUserEmail]);

  const checkRegistration = async () => {
    if (!currentUserEmail) {
      setChecking(false);
      return;
    }

    try {
      const participants = await participantsAPI.getByEventId(event.id);
      const userRegistered = participants.some(p => p.email === currentUserEmail);
      setIsRegistered(userRegistered);
    } catch (err) {
      console.error('Error checking registration:', err);
    } finally {
      setChecking(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const handleRegisterSuccess = () => {
    setShowRegisterForm(false);
    setIsRegistered(true);
    if (onUpdate) {
      onUpdate();
    }
    // Re-check registration
    checkRegistration();
  };

  return (
    <div className="user-event-card">
      <div className="user-event-header">
        <h3>{event.title}</h3>
        {isRegistered && (
          <span className="registered-badge">✓ Registered</span>
        )}
      </div>

      <div className="user-event-content">
        <div className="user-event-info">
          <div className="info-row">
            <span className="info-label">📍 Location:</span>
            <span className="info-value">{event.location}</span>
          </div>
          
          <div className="info-row">
            <span className="info-label">📅 Date & Time:</span>
            <span className="info-value">{formatDate(event.date)}</span>
          </div>
          
          {event.organizer && (
            <div className="info-row">
              <span className="info-label">👤 Organizer:</span>
              <span className="info-value">{event.organizer}</span>
            </div>
          )}
          
          {event.description && (
            <div className="info-row description-row">
              <span className="info-label">📝 About:</span>
              <span className="info-value">{event.description}</span>
            </div>
          )}
          
          <div className="info-row">
            <span className="info-label">🪑 Available Seats:</span>
            <span className="info-value">{event.seats || 0}</span>
          </div>
        </div>

        {!checking && !isRegistered && (
          <div className="register-section">
            {!showRegisterForm ? (
              <button
                onClick={() => setShowRegisterForm(true)}
                className="btn btn-primary btn-large btn-block register-btn"
              >
                Register for this Event
              </button>
            ) : (
              <div className="register-form-container">
                <ParticipantForm
                  eventId={event.id}
                  onParticipantRegistered={handleRegisterSuccess}
                />
                <button
                  onClick={() => setShowRegisterForm(false)}
                  className="btn btn-secondary btn-block"
                  style={{ marginTop: '10px' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {!checking && isRegistered && (
          <div className="registered-message">
            <p>✓ You are successfully registered for this event!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserEventCard;

