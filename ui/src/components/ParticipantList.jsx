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
    return <div style={{padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px'}}>Loading participants...</div>;
  }

  if (error) {
    return (
      <div style={{padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', textAlign: 'center'}}>
        <p style={{color: '#b91c1c', fontSize: '14px', marginBottom: '8px'}}>{error}</p>
        <button 
          onClick={fetchParticipants} 
          style={{padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px'}}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div style={{padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center'}}>
        <p style={{color: '#6b7280', fontSize: '14px'}}>No participants registered for this event.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
        <h4 style={{fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: 0}}>Participants ({participants.length})</h4>
        <button 
          onClick={fetchParticipants} 
          style={{background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', fontWeight: '500'}}
        >
          🔄 Refresh
        </button>
      </div>
      <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px'}}>
        {participants.map(participant => (
          <li 
            key={participant.id} 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              <strong style={{color: '#111827', fontSize: '14px'}}>{participant.name}</strong>
              <span style={{color: '#6b7280', fontSize: '13px'}}>{participant.email}</span>
              {participant.phone && (
                <span style={{color: '#9ca3af', fontSize: '12px'}}>{participant.phone}</span>
              )}
            </div>
            <button
              onClick={() => handleRemove(participant.id)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
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

