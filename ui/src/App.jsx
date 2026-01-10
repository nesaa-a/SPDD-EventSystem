import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AdminEventDetail from './components/AdminEventDetail';
import MyEvents from './components/MyEvents';
import SystemDashboard from './components/SystemDashboard';
import './index.css';

// Layout wrapper with navigation
function Layout({ user, onLogout, children }) {
  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f3f4f6'}}>
      <nav style={{backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100}}>
        <div style={{maxWidth: '1280px', margin: '0 auto', padding: '12px 24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '32px'}}>
              <a href="/dashboard" style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb', textDecoration: 'none'}}>🎉 EventHub</a>
              <div style={{display: 'flex', gap: '24px'}}>
                <a href="/dashboard" style={{color: '#4b5563', textDecoration: 'none', fontWeight: '500'}}>Events</a>
                <a href="/my-events" style={{color: '#4b5563', textDecoration: 'none', fontWeight: '500'}}>My Events</a>
                {user?.role === 'admin' && (
                  <>
                    <a href="/admin" style={{color: '#4b5563', textDecoration: 'none', fontWeight: '500'}}>Admin</a>
                    <a href="/system" style={{color: '#4b5563', textDecoration: 'none', fontWeight: '500'}}>System</a>
                  </>
                )}
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
              <span style={{fontSize: '14px', color: '#6b7280'}}>👤 {user?.username} ({user?.role})</span>
              <button
                onClick={onLogout}
                style={{padding: '8px 16px', fontSize: '14px', backgroundColor: '#ef4444', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer'}}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main style={{maxWidth: '1280px', margin: '0 auto', padding: '24px'}}>
        {children}
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/register" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Register onRegister={handleLogin} />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            user ? (
              <Layout user={user} onLogout={handleLogout}>
                <Dashboard user={user} onLogout={handleLogout} />
              </Layout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/my-events" 
          element={
            user ? (
              <Layout user={user} onLogout={handleLogout}>
                <MyEvents />
              </Layout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/system" 
          element={
            user && user.role === 'admin' ? (
              <Layout user={user} onLogout={handleLogout}>
                <SystemDashboard />
              </Layout>
            ) : <Navigate to="/dashboard" replace />
          } 
        />
        <Route 
          path="/admin" 
          element={
            user && user.role === 'admin' ? (
              <Layout user={user} onLogout={handleLogout}>
                <AdminDashboard user={user} onLogout={handleLogout} />
              </Layout>
            ) : <Navigate to="/dashboard" replace />
          } 
        />
        <Route 
          path="/admin/event/:eventId" 
          element={
            user && user.role === 'admin' ? (
              <Layout user={user} onLogout={handleLogout}>
                <AdminEventDetail user={user} onLogout={handleLogout} />
              </Layout>
            ) : <Navigate to="/dashboard" replace />
          } 
        />
        <Route 
          path="/" 
          element={
            <Navigate to={
              user 
                ? (user.role === 'admin' ? "/admin" : "/dashboard")
                : "/login"
            } replace />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
