import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, decodeJWT } from '../services/api';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simple validation
      if (!formData.username || !formData.password) {
        throw new Error('Please fill in all fields');
      }

      const response = await authAPI.login(formData);
      
      // Store token and user info
      localStorage.setItem('token', response.access_token);
      
      // Decode token to get user info
      const decodedToken = decodeJWT(response.access_token);
      console.log(decodedToken);
      
      const user = { 
        username: decodedToken.sub, 
        role: decodedToken.role || 'user',
        email: decodedToken.email || ''
      };
      localStorage.setItem('user', JSON.stringify(user));
      
      if (onLogin) {
        onLogin(user);
      }
      
      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px'
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
    padding: '48px',
    width: '100%',
    maxWidth: '420px'
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 18px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '16px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{textAlign: 'center', marginBottom: '32px'}}>
          <h1 style={{fontSize: '2rem', fontWeight: '700', color: '#111827', marginBottom: '8px'}}>Welcome Back</h1>
          <p style={{color: '#6b7280', fontSize: '16px'}}>Sign in to manage your events</p>
        </div>

        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div>
            <label htmlFor="username" style={labelStyle}>Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Enter your username"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '14px'}}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#4f46e5',
              color: 'white',
              borderRadius: '10px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              opacity: loading ? 0.7 : 1,
              marginTop: '8px'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{textAlign: 'center', marginTop: '24px'}}>
          <p style={{color: '#6b7280', fontSize: '14px'}}>
            Don't have an account?{' '}
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); navigate('/register'); }}
              style={{color: '#4f46e5', fontWeight: '600', textDecoration: 'none'}}
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

