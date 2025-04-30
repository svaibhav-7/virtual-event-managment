import React, { useState, useEffect } from 'react';
import './App.css';
import io from 'socket.io-client';
import Home from './components/Home';
import Room from './components/Room';
import Auth from './components/Auth';

function App() {
  // State management
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [socket, setSocket] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
    });

    setSocket(newSocket);

    // Load Font Awesome
    const fontAwesomeCDN = document.createElement("link");
    fontAwesomeCDN.rel = "stylesheet";
    fontAwesomeCDN.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css";
    document.head.appendChild(fontAwesomeCDN);

    return () => {
      newSocket.disconnect();
      document.head.removeChild(fontAwesomeCDN);
    };
  }, []);

  // Handle room joining from URL
  useEffect(() => {
    if (!socket) return;

    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromLink = urlParams.get('roomId');
    
    if (roomIdFromLink && username) {
      socket.emit('join-room', { 
        roomId: roomIdFromLink, 
        username: username || 'Guest' + Math.floor(Math.random() * 1000)
      });
      setRoomId(roomIdFromLink);
      setIsInRoom(true);
    }
  }, [socket, username]);

  return (
    <div className="app-main-bg">
      <div className="app-centered-container">
        <h1 className="heading app-heading-animated">
          <i className="fas fa-video" style={{ color: '#6a82fb', marginRight: '12px' }}></i>
          Virtual Event Room
        </h1>
        {!isAuthenticated ? (
          <Auth 
            setIsAuthenticated={setIsAuthenticated}
            setUsername={setUsername}
          />
        ) : !isInRoom ? (
          <Home
            roomId={roomId}
            setRoomId={setRoomId}
            username={username}
            setUsername={setUsername}
            setIsInRoom={setIsInRoom}
            socket={socket}
            setIsAuthenticated={setIsAuthenticated}
          />
        ) : (
          <Room
            roomId={roomId}
            username={username}
            setIsInRoom={setIsInRoom}
            socket={socket}
          />
        )}
      </div>
    {/* Removed duplicate JSX block */}
    </div>
  );
}

export default App;