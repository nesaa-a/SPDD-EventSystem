import { useState } from 'react';
import ParticipantForm from './ParticipantForm';
import ParticipantList from './ParticipantList';

const EventCard = ({ event, onUpdate, onDelete, userRole }) => {
  const [showParticipants, setShowParticipants] = useState(false);
  const [showParticipantForm, setShowParticipantForm] = useState(false);

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

  return (
    <div className="event-card">
      <div className="event-header">
        <h3>{event.title}</h3>
        <div className="event-actions">
          {userRole !== 'admin' && (
            <button onClick={() => setShowParticipantForm(!showParticipantForm)} className="btn btn-small">
              {showParticipantForm ? 'Hide' : 'Register Participant'}
            </button>
          )}
          {onDelete && userRole === 'admin' && (
            <button onClick={() => onDelete(event.id)} className="btn btn-small btn-danger">
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="event-details">
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
        <div className="event-info">
          <span className="info-item">
            <strong>📍 Location:</strong> {event.location}
          </span>
          <span className="info-item">
            <strong>📅 Date:</strong> {formatDate(event.date)}
          </span>
          <span className="info-item">
            <strong>🪑 Seats:</strong> {event.seats || 0}
          </span>
        </div>
      </div>

      {showParticipantForm && (
        <div className="participant-form-section">
          <ParticipantForm 
            eventId={event.id} 
            onParticipantRegistered={() => {
              setShowParticipantForm(false);
              if (onUpdate) onUpdate();
            }}
          />
        </div>
      )}

      <div className="participants-section">
        <button 
          onClick={() => setShowParticipants(!showParticipants)} 
          className="btn btn-link"
        >
          {showParticipants ? 'Hide Participants' : 'Show Participants'}
        </button>
        {showParticipants && (
          <ParticipantList eventId={event.id} />
        )}
      </div>
    </div>
  );
};

export default EventCard;

