import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, participantsAPI, waitlistAPI } from '../services/api';
import EventComments from './EventComments';

const AdminEventDetail = ({ user, onLogout }) => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportingCSV, setExportingCSV] = useState(false);

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
      
      try {
        const waitlistData = await waitlistAPI.getByEventId(parseInt(eventId));
        setWaitlist(waitlistData);
      } catch (err) {
        console.log('No waitlist data');
      }
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

  const handleCheckin = async (participantId) => {
    try {
      await participantsAPI.checkin(parseInt(eventId), participantId);
      fetchEventData();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Error checking in participant');
    }
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const blob = await participantsAPI.exportCSV(parseInt(eventId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_${eventId}_participants.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Error exporting CSV');
    } finally {
      setExportingCSV(false);
    }
  };

  const checkedInCount = participants.filter(p => p.checked_in).length;

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '24px',
    border: '1px solid #e5e7eb',
    marginBottom: '24px'
  };

  const btnPrimary = {
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  };

  const btnSuccess = {
    padding: '8px 16px',
    backgroundColor: '#16a34a',
    color: 'white',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  };

  const btnDanger = {
    padding: '6px 12px',
    backgroundColor: '#dc2626',
    color: 'white',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const btnSecondary = {
    padding: '8px 16px',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px'
  };

  if (loading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px'}}>
        <div style={{fontSize: '18px', color: '#6b7280'}}>Loading event details...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '24px', textAlign: 'center'}}>
        <p style={{color: '#b91c1c', marginBottom: '16px'}}>{error || 'Event not found'}</p>
        <button onClick={() => navigate('/admin')} style={btnPrimary}>
          Back to Admin Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Event Info Card */}
      <div style={cardStyle}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
          <div style={{flex: 1}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap'}}>
              <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#111827'}}>{event.title}</h1>
              {event.category && (
                <span style={{padding: '6px 14px', fontSize: '13px', fontWeight: '500', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '9999px'}}>
                  {event.category}
                </span>
              )}
            </div>
            <p style={{color: '#6b7280', marginBottom: '16px'}}>{event.description}</p>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px'}}>
              <div>
                <span style={{fontSize: '13px', color: '#9ca3af'}}>Location</span>
                <p style={{fontWeight: '500', color: '#374151'}}>📍 {event.location}</p>
              </div>
              <div>
                <span style={{fontSize: '13px', color: '#9ca3af'}}>Date</span>
                <p style={{fontWeight: '500', color: '#374151'}}>📅 {new Date(event.date).toLocaleString()}</p>
              </div>
              <div>
                <span style={{fontSize: '13px', color: '#9ca3af'}}>Registered</span>
                <p style={{fontWeight: '500', color: '#374151'}}>👥 {participants.length} / {event.seats}</p>
              </div>
              <div>
                <span style={{fontSize: '13px', color: '#9ca3af'}}>Checked In</span>
                <p style={{fontWeight: '500', color: '#374151'}}>✓ {checkedInCount} / {participants.length}</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/admin')} style={btnSecondary}>
            ← Back
          </button>
        </div>
      </div>

      {/* Participants Section */}
      <div style={cardStyle}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px'}}>
          <h2 style={{fontSize: '1.25rem', fontWeight: '600', color: '#1f2937'}}>
            Participants ({participants.length})
          </h2>
          <div style={{display: 'flex', gap: '8px'}}>
            <button
              onClick={handleExportCSV}
              disabled={exportingCSV || participants.length === 0}
              style={{...btnSuccess, opacity: (exportingCSV || participants.length === 0) ? 0.5 : 1}}
            >
              {exportingCSV ? 'Exporting...' : '📥 Export CSV'}
            </button>
            <button onClick={fetchEventData} style={btnSecondary}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {participants.length === 0 ? (
          <div style={{backgroundColor: '#f9fafb', borderRadius: '8px', padding: '32px', textAlign: 'center', color: '#6b7280'}}>
            No participants registered for this event yet.
          </div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', fontSize: '14px', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb'}}>
                  <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Name</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Email</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Phone</th>
                  <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Status</th>
                  <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(participant => (
                  <tr key={participant.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                    <td style={{padding: '12px 16px', fontWeight: '500'}}>{participant.name}</td>
                    <td style={{padding: '12px 16px'}}>{participant.email}</td>
                    <td style={{padding: '12px 16px'}}>{participant.phone || 'N/A'}</td>
                    <td style={{textAlign: 'center', padding: '12px 16px'}}>
                      {participant.checked_in ? (
                        <span style={{padding: '4px 12px', fontSize: '12px', fontWeight: '500', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '9999px'}}>
                          ✓ Checked In
                        </span>
                      ) : (
                        <span style={{padding: '4px 12px', fontSize: '12px', fontWeight: '500', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '9999px'}}>
                          Pending
                        </span>
                      )}
                    </td>
                    <td style={{textAlign: 'center', padding: '12px 16px'}}>
                      <div style={{display: 'flex', justifyContent: 'center', gap: '8px'}}>
                        {!participant.checked_in && (
                          <button
                            onClick={() => handleCheckin(participant.id)}
                            style={{padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px'}}
                          >
                            Check In
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveParticipant(participant.id)}
                          style={btnDanger}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Waitlist Section */}
      {waitlist.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '16px'}}>
            📋 Waitlist ({waitlist.length})
          </h2>
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', fontSize: '14px', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb'}}>
                  <th style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600', width: '60px'}}>#</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Name</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Email</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', fontWeight: '600'}}>Phone</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map(entry => (
                  <tr key={entry.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                    <td style={{textAlign: 'center', padding: '12px 16px', fontWeight: '600', color: '#6b7280'}}>{entry.position}</td>
                    <td style={{padding: '12px 16px', fontWeight: '500'}}>{entry.name}</td>
                    <td style={{padding: '12px 16px'}}>{entry.email}</td>
                    <td style={{padding: '12px 16px'}}>{entry.phone || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comments Section */}
      <EventComments eventId={parseInt(eventId)} />
    </div>
  );
};

export default AdminEventDetail;

