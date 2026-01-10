import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventForm from './EventForm';
import EventList from './EventList';
import EventSearch from './EventSearch';

const Dashboard = ({ user, onLogout }) => {
  const [showEventForm, setShowEventForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const navigate = useNavigate();

  const handleEventCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowEventForm(false);
    setSearchResults(null); // Clear search to show all events
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  const handleSearchResults = (results) => {
    setSearchResults(results);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <EventSearch onSearchResults={handleSearchResults} />

      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowEventForm(!showEventForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            {showEventForm ? '✖ Hide Form' : '+ Create New Event'}
          </button>
        </div>
      )}

      {!isAdmin && (
        <div style={{background: 'linear-gradient(to right, #2563eb, #7c3aed)', borderRadius: '12px', padding: '24px', color: 'white', marginBottom: '24px'}}>
          <h2 style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px'}}>🎉 Discover Amazing Events</h2>
          <p style={{opacity: 0.9}}>Browse and register for events that interest you. Your registered events will appear in "My Events".</p>
        </div>
      )}

      {isAdmin && showEventForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Event</h2>
          <EventForm
            onEventCreated={handleEventCreated}
            onCancel={() => setShowEventForm(false)}
          />
        </div>
      )}

      <EventList 
        refreshTrigger={refreshTrigger} 
        userRole={user?.role}
        searchResults={searchResults}
      />
    </div>
  );
};

export default Dashboard;

