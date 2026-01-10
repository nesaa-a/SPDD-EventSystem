import { useState, useEffect } from 'react';
import ParticipantForm from './ParticipantForm';
import { participantsAPI, waitlistAPI } from '../services/api';

const UserEventCard = ({ event, onUpdate }) => {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [waitlistPosition, setWaitlistPosition] = useState(null);
  const [checking, setChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      checkRegistration();
    } else {
      setChecking(false);
    }
  }, [event.id, currentUser]);

  const checkRegistration = async () => {
    if (!currentUser?.email) {
      setChecking(false);
      return;
    }

    try {
      const participants = await participantsAPI.getByEventId(event.id);
      setParticipantCount(participants.length);
      const userRegistered = participants.some(p => p.email === currentUser.email);
      setIsRegistered(userRegistered);
      
      // Check waitlist
      try {
        const waitlist = await waitlistAPI.getByEventId(event.id);
        const waitlistEntry = waitlist.find(w => w.email === currentUser.email);
        if (waitlistEntry) {
          setIsOnWaitlist(true);
          setWaitlistPosition(waitlistEntry.position);
        }
      } catch (err) {
        console.log('Waitlist check failed:', err);
      }
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
    checkRegistration();
  };

  const handleJoinWaitlist = async () => {
    if (!currentUser) return;
    
    setJoining(true);
    try {
      await waitlistAPI.join(event.id, {
        name: currentUser.username,
        email: currentUser.email,
        phone: ''
      });
      setIsOnWaitlist(true);
      checkRegistration();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to join waitlist');
    } finally {
      setJoining(false);
    }
  };

  const isFull = participantCount >= event.seats;

  return (
    <div style={{backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden', transition: 'all 0.2s', border: '1px solid #e5e7eb'}}>
      <div style={{padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
          <h3 style={{fontSize: '1.25rem', fontWeight: '600', color: '#111827'}}>{event.title}</h3>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            {event.category && (
              <span style={{padding: '4px 12px', fontSize: '12px', fontWeight: '500', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '9999px'}}>
                {event.category}
              </span>
            )}
            {isRegistered && (
              <span style={{padding: '4px 12px', fontSize: '12px', fontWeight: '500', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '9999px'}}>
                ✓ Registered
              </span>
            )}
            {isOnWaitlist && (
              <span style={{padding: '4px 12px', fontSize: '12px', fontWeight: '500', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '9999px'}}>
                #{waitlistPosition} on Waitlist
              </span>
            )}
          </div>
        </div>

        <div style={{fontSize: '14px', color: '#4b5563', marginBottom: '16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
            <span>📍</span>
            <span>{event.location}</span>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
            <span>📅</span>
            <span>{formatDate(event.date)}</span>
          </div>
          
          {event.description && (
            <p style={{color: '#6b7280', marginTop: '8px', marginBottom: '8px'}}>{event.description}</p>
          )}
          
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <span>🪑</span>
            <span style={isFull ? {color: '#dc2626', fontWeight: '500'} : {}}>
              {participantCount}/{event.seats} seats 
              {isFull ? ' (Full)' : ` (${event.seats - participantCount} available)`}
            </span>
          </div>
        </div>

        {!checking && !isRegistered && !isOnWaitlist && (
          <div style={{marginTop: '16px'}}>
            {!isFull ? (
              !showRegisterForm ? (
                <button
                  onClick={() => setShowRegisterForm(true)}
                  style={{width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', fontWeight: '500', border: 'none', cursor: 'pointer'}}
                >
                  Register for this Event
                </button>
              ) : (
                <div className="border-t pt-4">
                  <ParticipantForm
                    eventId={event.id}
                    onParticipantRegistered={handleRegisterSuccess}
                  />
                  <button
                    onClick={() => setShowRegisterForm(false)}
                    className="w-full mt-2 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={handleJoinWaitlist}
                disabled={joining}
                style={{width: '100%', padding: '12px', backgroundColor: '#eab308', color: 'white', borderRadius: '8px', fontWeight: '500', border: 'none', cursor: 'pointer', opacity: joining ? 0.5 : 1}}
              >
                {joining ? 'Joining...' : '📝 Join Waitlist'}
              </button>
            )}
          </div>
        )}

        {!checking && isRegistered && (
          <div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', color: '#15803d', fontSize: '14px'}}>
            <p>✓ You are registered! Check "My Events" for your QR code.</p>
          </div>
        )}
        
        {!checking && isOnWaitlist && !isRegistered && (
          <div style={{marginTop: '16px', padding: '12px', backgroundColor: '#fefce8', borderRadius: '8px', color: '#a16207', fontSize: '14px'}}>
            <p>📋 You are #{waitlistPosition} on the waitlist. We'll notify you if a spot opens!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserEventCard;

