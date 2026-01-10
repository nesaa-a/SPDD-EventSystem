import { useState, useEffect } from 'react';
import { myEventsAPI } from '../services/api';

function MyEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQR, setSelectedQR] = useState(null);

  useEffect(() => {
    loadMyEvents();
  }, []);

  const loadMyEvents = async () => {
    try {
      setLoading(true);
      const data = await myEventsAPI.getMyEvents();
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message || 'Failed to load your events');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const addToGoogleCalendar = (event) => {
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    
    const formatForCalendar = (date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    };

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatForCalendar(startDate)}/${formatForCalendar(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    window.open(url, '_blank');
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '24px',
    border: '1px solid #e5e7eb',
    marginBottom: '20px'
  };

  const badgeBlue = {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '9999px'
  };

  const badgeGreen = {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    borderRadius: '9999px'
  };

  const badgeYellow = {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: '#fef3c7',
    color: '#d97706',
    borderRadius: '9999px'
  };

  const btnPrimary = {
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const btnSecondary = {
    padding: '10px 16px',
    backgroundColor: '#4b5563',
    color: 'white',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  if (loading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px'}}>
        <div style={{fontSize: '1.25rem', color: '#6b7280'}}>Loading your events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', color: '#b91c1c'}}>
        {error}
      </div>
    );
  }

  return (
    <div style={{maxWidth: '900px', margin: '0 auto'}}>
      <h1 style={{fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '24px'}}>📅 My Events</h1>
      
      {events.length === 0 ? (
        <div style={{backgroundColor: '#f9fafb', borderRadius: '12px', padding: '48px', textAlign: 'center'}}>
          <p style={{color: '#6b7280', fontSize: '1.125rem', marginBottom: '16px'}}>You haven't registered for any events yet.</p>
          <a href="/" style={{color: '#2563eb', textDecoration: 'none'}}>Browse available events →</a>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          {events.map(({ event, registration }) => (
            <div key={registration.id} style={cardStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                <div style={{flex: 1}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap'}}>
                    {event.category && (
                      <span style={badgeBlue}>{event.category}</span>
                    )}
                    {registration.checked_in ? (
                      <span style={badgeGreen}>✓ Checked In</span>
                    ) : (
                      <span style={badgeYellow}>Pending Check-in</span>
                    )}
                  </div>
                  <h2 style={{fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '8px'}}>{event.title}</h2>
                  <p style={{color: '#6b7280', marginBottom: '16px'}}>{event.description}</p>
                  
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#6b7280', marginBottom: '16px'}}>
                    <p>📍 {event.location}</p>
                    <p>🗓️ {formatDate(event.date)}</p>
                  </div>
                  
                  <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    <button onClick={() => addToGoogleCalendar(event)} style={btnPrimary}>
                      📅 Add to Google Calendar
                    </button>
                    {registration.qr_code && (
                      <button
                        onClick={() => setSelectedQR(selectedQR === registration.id ? null : registration.id)}
                        style={btnSecondary}
                      >
                        {selectedQR === registration.id ? '🔼 Hide QR' : '📱 Show QR Code'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* QR Code Display */}
              {selectedQR === registration.id && registration.qr_code && (
                <div style={{marginTop: '24px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '10px', textAlign: 'center'}}>
                  <p style={{fontSize: '14px', color: '#6b7280', marginBottom: '12px'}}>Show this QR code at check-in:</p>
                  <img 
                    src={`data:image/png;base64,${registration.qr_code}`}
                    alt="Check-in QR Code"
                    style={{margin: '0 auto', width: '192px', height: '192px'}}
                  />
                  <p style={{fontSize: '12px', color: '#9ca3af', marginTop: '8px'}}>Registration #{registration.id}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyEvents;
