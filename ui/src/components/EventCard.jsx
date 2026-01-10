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

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '24px',
    border: '1px solid #e5e7eb',
    marginBottom: '20px'
  };

  const btnSmall = {
    padding: '8px 14px',
    fontSize: '13px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500'
  };

  const btnPrimary = {
    ...btnSmall,
    backgroundColor: '#2563eb',
    color: 'white'
  };

  const btnDanger = {
    ...btnSmall,
    backgroundColor: '#dc2626',
    color: 'white'
  };

  const btnLink = {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    padding: '8px 0',
    fontSize: '14px',
    fontWeight: '500'
  };

  return (
    <div style={cardStyle}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px'}}>
        <h3 style={{fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0}}>{event.title}</h3>
        <div style={{display: 'flex', gap: '8px'}}>
          {userRole !== 'admin' && (
            <button onClick={() => setShowParticipantForm(!showParticipantForm)} style={btnPrimary}>
              {showParticipantForm ? 'Hide' : 'Register Participant'}
            </button>
          )}
          {onDelete && userRole === 'admin' && (
            <button onClick={() => onDelete(event.id)} style={btnDanger}>
              Delete
            </button>
          )}
        </div>
      </div>

      <div style={{marginBottom: '16px'}}>
        {event.description && (
          <p style={{color: '#6b7280', marginBottom: '12px'}}>{event.description}</p>
        )}
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', color: '#4b5563'}}>
          <span>📍 <strong>Location:</strong> {event.location}</span>
          <span>📅 <strong>Date:</strong> {formatDate(event.date)}</span>
          <span>🪑 <strong>Seats:</strong> {event.seats || 0}</span>
        </div>
      </div>

      {showParticipantForm && (
        <div style={{backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '16px'}}>
          <ParticipantForm 
            eventId={event.id} 
            onParticipantRegistered={() => {
              setShowParticipantForm(false);
              if (onUpdate) onUpdate();
            }}
          />
        </div>
      )}

      <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '12px'}}>
        <button onClick={() => setShowParticipants(!showParticipants)} style={btnLink}>
          {showParticipants ? '▲ Hide Participants' : '▼ Show Participants'}
        </button>
        {showParticipants && (
          <div style={{marginTop: '12px'}}>
            <ParticipantList eventId={event.id} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;

