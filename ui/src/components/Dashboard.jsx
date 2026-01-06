import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventForm from './EventForm';
import EventList from './EventList';

const Dashboard = ({ user, onLogout }) => {
  const [showEventForm, setShowEventForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const handleEventCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowEventForm(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>📅 Event Management System</h1>
            <p>Welcome back, {user?.name || 'User'}! {isAdmin && <span className="role-badge">Admin</span>}</p>
          </div>
          <div className="header-actions">
            {isAdmin && (
              <button onClick={() => navigate('/admin')} className="btn btn-secondary">
                Admin Dashboard
              </button>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {isAdmin && (
          <div className="main-actions">
            <button
              onClick={() => setShowEventForm(!showEventForm)}
              className="btn btn-primary btn-large"
            >
              {showEventForm ? 'Hide Form' : '+ Create New Event'}
            </button>
          </div>
        )}

        {!isAdmin && (
          <div className="user-welcome">
            <h2>Browse Available Events</h2>
            <p>Select an event below to register as a participant</p>
          </div>
        )}

        {isAdmin && showEventForm && (
          <div className="event-form-section">
            <EventForm
              onEventCreated={handleEventCreated}
              onCancel={() => setShowEventForm(false)}
            />
          </div>
        )}

        <EventList refreshTrigger={refreshTrigger} userRole={user?.role} currentUserEmail={user?.email} />
      </main>

      <footer className="app-footer">
        <p>© 2024 Event Management System</p>
      </footer>
    </div>
  );
};

export default Dashboard;

