import React, { useState } from 'react';
import { Snackbar } from '@mui/material';
import './AuthHome.css';

const Home = ({ roomId, setRoomId, username, setUsername, setIsInRoom, socket, setIsAuthenticated }) => {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [notification, setNotification] = useState('');

  const handleJoinRoom = () => {
    if (roomId && username) {
      socket.emit('join-room', { roomId, username });
      setIsInRoom(true);
    }
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substr(2, 9);
    setRoomId(newRoomId);
    setIsCreatingRoom(false);

    socket.emit('join-room', newRoomId, username);
    setIsInRoom(true);
  };

  return (
    <div className="home-component">
      <div className="auth-container">
        <div className="auth-form">
          <button onClick={() => setIsAuthenticated(false)} className="auth-button" style={{ marginBottom: '20px' }}>
            Back to Login
          </button>
          {!isCreatingRoom ? (
            <div className="form-group">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="form-group input"
              />
              <input
                type="text"
                placeholder="Enter Your Name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-group input"
              />
              <div className="auth-button-container">
                <button onClick={handleJoinRoom} className="auth-button">
                  Join Room
                </button>
                <button onClick={() => setIsCreatingRoom(true)} className="auth-button">
                  Create Room
                </button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <h3>Creating Room...</h3>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={handleCreateRoom} className="auth-button">
                  Create Room with ID: {roomId}
                </button>
                <button onClick={() => setIsCreatingRoom(false)} className="auth-button">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification('')}
        message={notification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </div>
  );
};

export default Home;
