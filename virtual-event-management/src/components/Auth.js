import React, { useState } from 'react';
import './AuthHome.css';

const Auth = ({ setIsAuthenticated, setUsername }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUserNameInput] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Basic validation
    if (!email || !password || (!isLogin && !username)) {
      setError('Please fill in all fields');
      return;
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Password length validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      if (isLogin) {
        // Login logic
        const response = await fetch('http://localhost:3001/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setSuccessMessage('Login successful!');
          setIsAuthenticated(true);
          setUsername(data.user.username);
        } else {
          setError(data.message || 'Login failed');
        }
      } else {
        // Signup logic
        const response = await fetch('http://localhost:3001/api/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            email,
            password
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setSuccessMessage('Account created successfully! Please login.');
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setUserNameInput('');
        } else {
          setError(data.message || 'Error creating account');
        }
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      console.error('Auth error:', error);
    }
  };

  return (
    <div className="auth-component">
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <h1>{isLogin ? 'Login' : 'Sign Up'}</h1>
          </div>
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUserNameInput(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="8"
              />
            </div>
            <button type="submit" className="auth-button">
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
          <div className="auth-switch">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccessMessage('');
                setEmail('');
                setPassword('');
                setUserNameInput('');
              }}>
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;