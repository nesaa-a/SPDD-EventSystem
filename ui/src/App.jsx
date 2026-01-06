import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AdminEventDetail from './components/AdminEventDetail';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      setUser(JSON.parse(currentUser));
    }
    
    // Initialize default admin user if it doesn't exist
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const adminExists = users.find(u => u.email === 'admin@example.com');
    
    if (!adminExists) {
      const defaultAdmin = {
        id: 1,
        name: 'Admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      };
      users.push(defaultAdmin);
      localStorage.setItem('users', JSON.stringify(users));
      console.log('Admin user created:', defaultAdmin);
    }
    
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
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
            user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/admin" 
          element={
            user && user.role === 'admin' ? (
              <AdminDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          } 
        />
        <Route 
          path="/admin/event/:eventId" 
          element={
            user && user.role === 'admin' ? (
              <AdminEventDetail user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
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
