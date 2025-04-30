const express = require("express");
  const http = require("http");
  const { Server } = require("socket.io");
  const cors = require("cors");
  const path = require("path");
  const mongoose = require("mongoose");
  const bcrypt = require("bcryptjs");
  require('dotenv').config();

  // MongoDB connection with retry mechanism
  const connectDB = async (retries = 5) => {
      try {
          await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://virtualevents:virtualevents123@cluster0.mongodb.net/virtual-event-db', {
              serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
              socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
          });
          console.log('Connected to MongoDB Atlas');
          return true;
      } catch (err) {
          if (retries > 0) {
              console.log(`MongoDB connection failed. Retrying... (${retries} attempts remaining)`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              return connectDB(retries - 1);
          }
          console.error('MongoDB connection error:', err);
          throw err;
      }
  };

  // Initialize database connection
  connectDB()
      .catch(err => {
          console.error('Failed to connect to MongoDB:', err);
          process.exit(1);
      });

  // User Schema
  const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true }
  });

  const User = mongoose.model('User', userSchema);

  const app = express();

  // CORS configuration
  app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
  }));

  app.use(express.json());

  // API routes
  app.post('/api/signup', async (req, res) => {
      try {
          const { username, email, password } = req.body;
          
          if (!username || !email || !password) {
              return res.status(400).json({ message: 'All fields are required' });
          }

          // Check if user already exists
          const existingUser = await User.findOne({ $or: [{ email }, { username }] });
          if (existingUser) {
              return res.status(400).json({ 
                  message: existingUser.email === email ? 
                      'User is already registered' : 
                      'Username is already taken' 
              });
          }

          // Hash password
          const hashedPassword = await bcrypt.hash(password, 10);

          // Create new user
          const user = new User({
              username,
              email,
              password: hashedPassword
          });

          await user.save();
          res.status(201).json({ message: 'User created successfully' });
      } catch (error) {
          console.error('Signup error:', error);
          if (error.name === 'MongoError' || error.name === 'MongoServerError') {
              return res.status(503).json({ message: 'Database error. Please try again later.' });
          }
          res.status(500).json({ message: 'Error creating user' });
      }
  });

  // Login endpoint
  app.post('/api/login', async (req, res) => {
      try {
          const { email, password } = req.body;
          
          if (!email || !password) {
              return res.status(400).json({ message: 'Email and password are required' });
          }

          // Find user by email
          const user = await User.findOne({ email });
          if (!user) {
              return res.status(400).json({ message: 'Invalid email or password' });
          }

          // Compare password
          const isValidPassword = await bcrypt.compare(password, user.password);
          if (!isValidPassword) {
              return res.status(400).json({ message: 'Invalid email or password' });
          }

          // Send success response with user data (excluding password)
          res.status(200).json({
              message: 'Login successful',
              user: {
                  id: user._id,
                  username: user.username,
                  email: user.email
              }
          });
      } catch (error) {
          console.error('Login error:', error);
          if (error.name === 'MongoError' || error.name === 'MongoServerError') {
              return res.status(503).json({ message: 'Database error. Please try again later.' });
          }
          res.status(500).json({ message: 'Error during login' });
      }
  });

  // Socket.io setup
  const server = http.createServer(app);
  const io = new Server(server, {
      cors: {
          origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
          methods: ["GET", "POST"],
          credentials: true
      }
  });

  // Socket.io logic
  // Store active rooms and users
  const activeRooms = {};

  io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      socket.on("join-room", (roomId, username) => {
          socket.join(roomId);
          socket.roomId = roomId;
          socket.username = username;

          // Initialize room if it doesn't exist
          if (!activeRooms[roomId]) {
              activeRooms[roomId] = { users: [] };
          }

          // Add user to room
          activeRooms[roomId].users.push({
              id: socket.id,
              username,
          });

          // Notify others in the room
          socket.to(roomId).emit("user-connected", { userId: socket.id, username });

          // Send current room users to the new user
          io.to(socket.id).emit("room-users", {
              users: activeRooms[roomId].users,
          });

          console.log(`${username} joined room ${roomId}`);
      });

      socket.on("signal", ({ to, from, signal }) => {
          io.to(to).emit("signal", { from, signal });
      });
      socket.on('get-room-users', (roomId, callback) => {
          if (activeRooms[roomId]) {
              callback(activeRooms[roomId].users);
          } else {
              callback([]);
          }
      });
      socket.on("disconnect", () => {
          if (socket.roomId) {
              const roomId = socket.roomId;
              const room = activeRooms[roomId];
              
              if (room) {
                  // Remove user from room
                  activeRooms[roomId].users = room.users.filter(user => user.id !== socket.id);

                  // Notify others in the room
                  socket.to(roomId).emit("user-disconnected", { userId: socket.id });

                  // Clean up empty rooms
                  if (activeRooms[roomId].users.length === 0) {
                      delete activeRooms[roomId];
                  }
              }
          }
          console.log("User disconnected:", socket.id);
      });

      // Handle chat messages
      socket.on("send-message", ({ roomId, message }) => {
          socket.to(roomId).emit("receive-message", {
              sender: socket.username,
              message,
          });
      });

      // Handle raised hands
      socket.on("raise-hand", ({ roomId }) => {
          socket.to(roomId).emit("user-raised-hand", {
              username: socket.username,
          });
      });
  });

  // Serve React app - This should be after API routes
  app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, '../build/index.html'));
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
  });