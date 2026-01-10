import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, decodeJWT } from '../services/api';

const Register = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
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
      // Validation
      if (!formData.username || !formData.email || !formData.password) {
        throw new Error('Please fill in all fields');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };

      // Register the user
      await authAPI.register(userData);
      
      // After successful registration, automatically log in
      const loginResponse = await authAPI.login({
        username: formData.username,
        password: formData.password
      });
      
      // Store token and user info
      localStorage.setItem('token', loginResponse.access_token);
      
      // Decode token to get user info
      const decodedToken = decodeJWT(loginResponse.access_token);
      const user = { 
        username: decodedToken.sub, 
        role: decodedToken.role || 'user',
        email: decodedToken.email || ''
      };
      localStorage.setItem('user', JSON.stringify(user));
      
      if (onRegister) {
        onRegister(user);
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
          <h1 style={{fontSize: '2rem', fontWeight: '700', color: '#111827', marginBottom: '8px'}}>Create Account</h1>
          <p style={{color: '#6b7280', fontSize: '16px'}}>Sign up to start managing events</p>
        </div>

        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '18px'}}>
          <div>
            <label htmlFor="username" style={labelStyle}>Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="johndoe"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your.email@example.com"
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
              placeholder="At least 6 characters"
              minLength={6}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
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
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div style={{textAlign: 'center', marginTop: '24px'}}>
          <p style={{color: '#6b7280', fontSize: '14px'}}>
            Already have an account?{' '}
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); navigate('/login'); }}
              style={{color: '#4f46e5', fontWeight: '600', textDecoration: 'none'}}
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

