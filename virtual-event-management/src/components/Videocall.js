import React, { useRef, useEffect, useState, useCallback } from "react";
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaShareSquare, FaStop, FaHandPaper, FaPhoneSlash, FaMagic, FaDownload } from "react-icons/fa";
import { IoHandLeftOutline } from "react-icons/io5";
import { RiEmotionLaughLine } from "react-icons/ri";
import './VideoCall.css';

const VideoCall = ({
  mediaStream,
  setMediaStream,
  screenStream,
  setScreenStream,
  isCameraOn,
  setIsCameraOn,
  isMicOn,
  setIsMicOn,
  recorder,
  setRecorder,
  recordedChunks,
  setRecordedChunks,
  sendEmojiReaction,
  emojiReactions,
  users,
  raisedHands,
  toggleRaiseHand,
  meetLink,
  username,
  handleEndCall,
  socket,
  roomId
}) => {
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const animatedCanvasRef = useRef(null);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [filterMode, setFilterMode] = useState(false);
  const [animationMode, setAnimationMode] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 480, height: 360 });
  const [isCapturingAnimation, setIsCapturingAnimation] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedAnimatedPhoto, setCapturedAnimatedPhoto] = useState(null);
  const [peerConnections, setPeerConnections] = useState({});
  
  // Basic filter effect processor
  const applyBasicFilter = useCallback(() => {
    if (!filterMode || !isCameraOn || !videoRef.current || !canvasRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationRef.current = requestAnimationFrame(applyBasicFilter);
      return;
    }

    // Reduce the canvas size to 75% of the original video size
    const targetWidth = Math.floor(video.videoWidth * 0.75);
    const targetHeight = Math.floor(video.videoHeight * 0.75);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      setVideoDimensions({ width: targetWidth, height: targetHeight });
    }

    const processFrame = () => {
      try {
        // Draw the video frame to the canvas with scaling
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        // Apply a simple filter using canvas built-in methods
        ctx.filter = 'brightness(1.1) contrast(1.1) saturate(1.2)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        
        animationRef.current = requestAnimationFrame(processFrame);
      } catch (error) {
        console.error("Error processing frame:", error);
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    processFrame();
  }, [filterMode, isCameraOn]);

  // Animation effect processor
  const applyAnimationEffect = useCallback(() => {
    if (!animationMode || !isCameraOn || !videoRef.current || !animatedCanvasRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const canvas = animatedCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationRef.current = requestAnimationFrame(applyAnimationEffect);
      return;
    }

    // Reduce the canvas size to 75% of the original video size
    const targetWidth = Math.floor(video.videoWidth * 0.75);
    const targetHeight = Math.floor(video.videoHeight * 0.75);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      setVideoDimensions({ width: targetWidth, height: targetHeight });
    }

    const processFrame = () => {
      try {
        // Draw original frame with scaling
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Edge detection and cartoon effect
        const edgeDetection = (x, y, width, data) => {
          const idx = (y * width + x) * 4;
          if (x === 0 || y === 0 || x === width - 1 || y === canvas.height - 1) return false;
          
          const currentPixel = {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2]
          };
          
          const leftIdx = (y * width + (x - 1)) * 4;
          const left = {
            r: data[leftIdx],
            g: data[leftIdx + 1],
            b: data[leftIdx + 2]
          };
          
          const topIdx = ((y - 1) * width + x) * 4;
          const top = {
            r: data[topIdx],
            g: data[topIdx + 1],
            b: data[topIdx + 2]
          };
          
          const diff = Math.abs(currentPixel.r - left.r) + 
                       Math.abs(currentPixel.g - left.g) + 
                       Math.abs(currentPixel.b - left.b) +
                       Math.abs(currentPixel.r - top.r) + 
                       Math.abs(currentPixel.g - top.g) + 
                       Math.abs(currentPixel.b - top.b);
          
          return diff > 100; // Threshold for edge detection
        };
        
        // Prepare a new image data for the result
        const resultData = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
          resultData[i] = data[i];
          resultData[i + 1] = data[i + 1];
          resultData[i + 2] = data[i + 2];
          resultData[i + 3] = data[i + 3];
        }
        
        // Apply color quantization for cartoon effect
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            
            // Color quantization (reduces color palette)
            resultData[idx] = Math.floor(resultData[idx] / 32) * 32 + 16;
            resultData[idx + 1] = Math.floor(resultData[idx + 1] / 32) * 32 + 16;
            resultData[idx + 2] = Math.floor(resultData[idx + 2] / 32) * 32 + 16;
            
            // Apply edge detection
            if (edgeDetection(x, y, canvas.width, data)) {
              resultData[idx] = 0;
              resultData[idx + 1] = 0;
              resultData[idx + 2] = 0;
            }
          }
        }
        
        // Create new ImageData and put it back on canvas
        const resultImageData = new ImageData(resultData, canvas.width, canvas.height);
        ctx.putImageData(resultImageData, 0, 0);
        
        // Add animation effect - subtle movement
        if (!isCapturingAnimation) {
          const time = Date.now() * 0.001;
          const amplitude = 1.5;
          const frequency = 0.5;
          
          // Save current transform
          ctx.save();
          
          // Apply subtle wave effect
          ctx.translate(
            Math.sin(time * frequency) * amplitude,
            Math.cos(time * frequency) * amplitude
          );
          
          // Draw with slightly altered colors
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(255, 255, 255, 0.05)`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Restore transform
          ctx.restore();
        }
        
        // Continue animation loop
        animationRef.current = requestAnimationFrame(processFrame);
      } catch (error) {
        console.error("Error processing animation frame:", error);
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    // Start the continuous animation loop
    processFrame();
  }, [animationMode, isCameraOn, isCapturingAnimation]);

  // Initialize and cleanup effects
  useEffect(() => {
    if (filterMode && isCameraOn) {
      applyBasicFilter();
    } else if (animationMode && isCameraOn) {
      applyAnimationEffect();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [filterMode, animationMode, isCameraOn, applyBasicFilter, applyAnimationEffect]);

  // Update video sources when streams change
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = mediaStream;
    if (screenRef.current) screenRef.current.srcObject = screenStream;
  }, [mediaStream, screenStream]);

  // Active speaker detection using Web Audio API
  useEffect(() => {
    let audioContext, analyser, sourceNode, intervalId;
    
    const analyzeAudio = async () => {
      if (!isMicOn || !mediaStream || mediaStream.getAudioTracks().length === 0) {
        setActiveSpeaker(null);
        return;
      }
      
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        sourceNode.connect(analyser);
        
        intervalId = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setActiveSpeaker(avg > 25 ? username : null);
        }, 300);
      } catch (error) {
        console.error("Audio analysis error:", error);
        setActiveSpeaker(null);
      }
    };
    
    analyzeAudio();
    return () => {
      clearInterval(intervalId);
      if (sourceNode) sourceNode.disconnect();
      if (audioContext) audioContext.close();
    };
  }, [isMicOn, mediaStream, username]);

  // Media control functions
  const startAudioStream = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Create a new MediaStream that combines existing video tracks with new audio
      const newStream = new MediaStream();
      
      // Add existing video tracks if they exist
      if (mediaStream) {
        mediaStream.getVideoTracks().forEach(track => newStream.addTrack(track));
      }
      
      // Add the new audio track
      audioStream.getAudioTracks().forEach(track => {
        track.enabled = true; // Make sure audio is enabled
        newStream.addTrack(track);
      });
      
      setMediaStream(newStream);
      setIsMicOn(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
      alert("Microphone access denied!");
    }
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      mediaStream?.getVideoTracks().forEach((track) => track.stop());
      setIsCameraOn(false);
      setFilterMode(false);
      setAnimationMode(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 960, height: 540 },
          audio: isMicOn,
        });
        setMediaStream(stream);
        setIsCameraOn(true);
      } catch (error) {
        console.error("Camera access denied:", error);
        alert("Camera access denied!");
      }
    }
  };

  const toggleMic = async () => {
    if (mediaStream) {
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        // Toggle the enabled state of all audio tracks
        audioTracks.forEach(track => {
          track.enabled = !track.enabled;
        });
        setIsMicOn(audioTracks[0].enabled);
      } else {
        // If no audio tracks exist, start a new audio stream
        await startAudioStream();
      }
    } else {
      // If no media stream exists at all, start a new audio stream
      await startAudioStream();
    }
  };

  const toggleFilterMode = () => {
    setFilterMode(!filterMode);
    if (!filterMode) {
      setAnimationMode(false);
    }
  };

  const toggleAnimationMode = () => {
    setAnimationMode(!animationMode);
    if (!animationMode) {
      setFilterMode(false);
    }
  };

  // Screen sharing functions
  const startScreenSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: "monitor" },
        audio: true 
      });
      
      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };
      
      setScreenStream(stream);
    } catch (error) {
      console.error("Screen sharing error:", error);
      if (error.name !== "NotAllowedError") {
        alert("Screen sharing access denied!");
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
  };

  // Recording functions
  const startRecording = () => {
    if (mediaStream) {
      try {
        const newRecorder = new MediaRecorder(mediaStream);
        newRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };
        newRecorder.start(100); // Collect data every 100ms
        setRecorder(newRecorder);
      } catch (error) {
        console.error("Recording error:", error);
        alert("Failed to start recording!");
      }
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
      setRecorder(null);
    }
  };

  // Toggle recording function
  const toggleRecording = () => {
    if (recorder) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Unified download function - handles different types of content
  const downloadContent = () => {
    // Case 1: Download recording if available
    if (recordedChunks.length > 0) {
      try {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${username}-recording-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } catch (error) {
        console.error("Download error:", error);
        alert("Failed to download recording!");
      }
      return;
    }
    
    // Case 2: Take and download filtered photo
    if (filterMode && canvasRef.current) {
      const canvas = canvasRef.current;
      
      // Create a temporary canvas with reduced dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 240;
      tempCanvas.height = 180;
      const ctx = tempCanvas.getContext('2d');
      
      // Draw the original canvas to the smaller canvas
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Get the reduced image data
      const dataUrl = tempCanvas.toDataURL("image/png");
      setCapturedPhoto(dataUrl);

      // Create download link
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `photo-${new Date().toISOString()}.png`;
      link.click();
      return;
    }
    
    // Case 3: Take and download animation snapshot
    if (animationMode && animatedCanvasRef.current) {
      setIsCapturingAnimation(true);
      // Give time for the next animation frame to render without animation effects
      setTimeout(() => {
        const canvas = animatedCanvasRef.current;
        
        // Create a temporary canvas with reduced dimensions
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 240;
        tempCanvas.height = 180;
        const ctx = tempCanvas.getContext('2d');
        
        // Draw the original canvas to the smaller canvas
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get the reduced image data
        const dataUrl = tempCanvas.toDataURL("image/png");
        setCapturedAnimatedPhoto(dataUrl);
        
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `animated-photo-${new Date().toISOString()}.png`;
        link.click();
        
        setIsCapturingAnimation(false);
      }, 50);
      return;
    }
    
    // Case 4: If no special mode active, take a normal screenshot from video
    if (isCameraOn && videoRef.current) {
      const video = videoRef.current;
      
      // Create a temporary canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 240;
      tempCanvas.height = 180;
      const ctx = tempCanvas.getContext('2d');
      
      // Draw the video to the canvas
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Get the image data
      const dataUrl = tempCanvas.toDataURL("image/png");
      
      // Create download link
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `screenshot-${new Date().toISOString()}.png`;
      link.click();
    }
  };

  // Component for remote participant's video
  const ParticipantVideo = ({ user }) => (
    <div className={`participant ${activeSpeaker === user ? "active-speaker" : ""}`}>
      <video className="video" autoPlay playsInline />
      <div className="participant-info">
        <span>{user}</span>
        {raisedHands.includes(user) && (
          <IoHandLeftOutline className="raised-hand" title="Raised hand" />
        )}
        {activeSpeaker === user && (
          <div className="speaker-indicator" title="Speaking">🎤</div>
        )}
      </div>
    </div>
  );

  // Add chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Add chat event listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      setMessages(prev => [...prev, {
        sender: data.sender,
        content: data.message,
        timestamp: new Date().toLocaleTimeString(),
        isSent: false
      }]);
    };

    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket]);

  // Add send message function
  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      roomId,
      message: newMessage
    };

    socket.emit('send-message', messageData);

    setMessages(prev => [...prev, {
      sender: username,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString(),
      isSent: true
    }]);

    setNewMessage('');
  };

  useEffect(() => {
    // Initialize WebRTC peer connections when users join
    socket.on("user-connected", async ({ userId, username }) => {
      try {
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        // Add local tracks to the peer connection
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, mediaStream);
          });
        }

        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("signal", {
          to: userId,
          from: socket.id,
          signal: { type: "offer", sdp: offer }
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("signal", {
              to: userId,
              from: socket.id,
              signal: { type: "ice-candidate", candidate: event.candidate }
            });
          }
        };

        // Handle remote tracks
        peerConnection.ontrack = (event) => {
          const [remoteStream] = event.streams;
          // Find the remote video element and set its srcObject
          const remoteVideo = document.querySelector(`[data-user-id="${userId}"]`);
          if (remoteVideo && remoteStream) {
            remoteVideo.srcObject = remoteStream;
          }
        };

        // Store the peer connection
        setPeerConnections(prev => ({
          ...prev,
          [userId]: peerConnection
        }));
      } catch (error) {
        console.error("Error establishing peer connection:", error);
      }
    });

    // Handle incoming WebRTC signaling
    socket.on("signal", async ({ from, signal }) => {
      try {
        const peerConnection = peerConnections[from] || new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        if (signal.type === "offer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          // Add local tracks if available
          if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
              peerConnection.addTrack(track, mediaStream);
            });
          }

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          socket.emit("signal", {
            to: from,
            from: socket.id,
            signal: { type: "answer", sdp: answer }
          });

        } else if (signal.type === "answer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "ice-candidate") {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }

        // Store or update the peer connection
        if (!peerConnections[from]) {
          setPeerConnections(prev => ({
            ...prev,
            [from]: peerConnection
          }));
        }
      } catch (error) {
        console.error("Error handling WebRTC signal:", error);
      }
    });

    return () => {
      socket.off("user-connected");
      socket.off("signal");
      // Close all peer connections
      Object.values(peerConnections).forEach(pc => pc.close());
    };
  }, [socket, mediaStream, peerConnections, setPeerConnections]);

  return (
    <div className="videoSection">
      <div className="videoContainer">
        {/* Local User */}
        <div className={`video-wrapper ${!isCameraOn ? "camera-off" : ""}`}>
          {isCameraOn && (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                className="video"
                playsInline
                style={{ display: !filterMode && !animationMode ? 'block' : 'none' }}
              />
              <canvas
                ref={canvasRef}
                className="video filter-canvas"
                style={{
                  display: filterMode ? 'block' : 'none',
                  width: videoDimensions.width > 0 ? videoDimensions.width : '100%',
                  height: videoDimensions.height > 0 ? videoDimensions.height : 'auto',
                  maxHeight: '350px'
                }}
              />
              <canvas
                ref={animatedCanvasRef}
                className="video animation-canvas"
                style={{
                  display: animationMode ? 'block' : 'none',
                  width: videoDimensions.width > 0 ? videoDimensions.width : '100%',
                  height: videoDimensions.height > 0 ? videoDimensions.height : 'auto',
                  maxHeight: '350px'
                }}
              />
            </>
          )}
          <div className="user-status">
            <span>{username}</span>
            {raisedHands.includes(username) && (
              <IoHandLeftOutline className="raised-hand" title="Your raised hand" />
            )}
            {activeSpeaker === username && (
              <div className="speaker-indicator" title="You're speaking">🎤</div>
            )}
            {filterMode && (
              <div className="filter-badge" title="Filter Mode Active">
                <FaMagic /> Filter
              </div>
            )}
            {animationMode && (
              <div className="animation-badge" title="Animation Mode Active">
                <RiEmotionLaughLine /> Animated
              </div>
            )}
          </div>
          {!isCameraOn && (
            <div className="camera-off-placeholder">
              <div className="initials">
                {username.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {screenStream && (
          <div className="screen-share">
            <video ref={screenRef} autoPlay className="video" playsInline />
            <div className="screen-share-label">
              <FaShareSquare /> Screen Sharing: {username}
            </div>
          </div>
        )}

        {users.map((user) => (
          <ParticipantVideo key={user} user={user} />
        ))}
      </div>

      {/* Add chat container */}
      <div className={`chat-container ${!isChatOpen ? 'chat-hidden' : ''}`}>
        <div className="chat-header">
          <span className="chat-title">Chat</span>
          <button className="chat-close" onClick={() => setIsChatOpen(!isChatOpen)}>
            {isChatOpen ? '×' : '+'}
          </button>
        </div>
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.isSent ? 'sent' : 'received'}`}>
              <div className="message-content">
                {msg.content}
              </div>
              <div className="message-info">
                <span className="bullet"></span>
                <span className="message-sender">{msg.isSent ? 'You' : msg.sender}</span>
                <span className="bullet">•</span>
                <span className="message-time">{msg.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                sendMessage();
              }
            }}
          />
          <button className="send-button" onClick={sendMessage}>
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>

      <div className="controls">
        <button onClick={toggleCamera} className={`controlButton ${isCameraOn ? "active" : ""}`}>
          {isCameraOn ? <FaVideo /> : <FaVideoSlash />}
        </button>

        <button onClick={toggleMic} className={`controlButton ${isMicOn ? "active" : ""}`}>
          {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>

        {isCameraOn && (
          <>
            <button 
              onClick={toggleFilterMode} 
              className={`controlButton ${filterMode ? "active filter-active" : ""}`}
              title="Filter Effect"
            >
              <FaMagic />
            </button>
            
            <button 
              onClick={toggleAnimationMode} 
              className={`controlButton ${animationMode ? "active animation-active" : ""}`}
              title="Animation Effect"
            >
              <RiEmotionLaughLine />
            </button>
          </>
        )}

        {/* Unified download button that works contextually */}
        {(isCameraOn || recordedChunks.length > 0) && (
          <button 
            onClick={downloadContent} 
            className="controlButton"
            title={recordedChunks.length > 0 ? "Download Recording" : (filterMode ? "Download Filtered Photo" : (animationMode ? "Download Animated Photo" : "Take Screenshot"))}
          >
            <FaDownload />
          </button>
        )}

        <button 
          onClick={screenStream ? stopScreenSharing : startScreenSharing} 
          className={`controlButton ${screenStream ? "active" : ""}`} 
          title={screenStream ? "Stop Screen Sharing" : "Start Screen Sharing"}
        >
          {screenStream ? <FaStop /> : <FaShareSquare />}
        </button>
        
        {/* Recording control */}
        <button 
          onClick={toggleRecording} 
          className={`controlButton ${recorder ? "active stop-recording" : ""}`}
          title={recorder ? "Stop Recording" : "Start Recording"}
        >
          {recorder ? (
            <>
              <FaStop /> Stop
            </>
          ) : (
            <>
              <span className="rec-dot">●</span> REC
            </>
          )}
        </button>
        
        <button 
          onClick={toggleRaiseHand} 
          className={`controlButton raise-hand ${raisedHands.includes(username) ? "active" : ""}`} 
          title={raisedHands.includes(username) ? "Lower Hand" : "Raise Hand"}
        >
          <FaHandPaper />
        </button>
        
        <button onClick={handleEndCall} className="controlButton end-call" title="End Call">
          <FaPhoneSlash />
        </button>
      </div>

      {/* Additional Features */}
      <div className="additional-features">
        <div className="emoji-controls">
          <div>
            {['😊', '👍', '🎉', '❤️', '😂'].map((emoji) => (
              <button 
                key={emoji} 
                onClick={() => sendEmojiReaction(emoji)} 
                className="emojiButton"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        
        <div className="emoji-reactions-display">
          <div className="emoji-container">
            {emojiReactions.map((emoji, index) => (
              <span key={index} className="emoji-reaction">
                {emoji}
              </span>
            ))}
          </div>
        </div>
        
        <div className="meet-info">
          <h4>Meeting Info:</h4>
          <div className="meet-link">
            <span>Link: </span>
            <a href={meetLink} target="_blank" rel="noopener noreferrer">
              {meetLink}
            </a>
          </div>
          <div className="participant-count">
            Participants: {users.length + 1}
          </div>
          <div className="network-status">
            Connection: {navigator.connection?.effectiveType || "Unknown"}
          </div>
        </div>
      </div>

      {/* Display captured photos with reduced dimensions */}
      {(capturedPhoto || capturedAnimatedPhoto) && (
        <div className="captured-photos">
          {capturedPhoto && (
            <div className="captured-photo">
              <h4>Captured Photo</h4>
              <img 
                src={capturedPhoto} 
                alt="Your filtered selfie" 
                style={{
                  maxWidth: '80px',
                  maxHeight: '60px',
                  height: 'auto',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }} 
              />
            </div>
          )}
          
          {capturedAnimatedPhoto && (
            <div className="captured-photo">
              <h4>Captured Animated Photo</h4>
              <img 
                src={capturedAnimatedPhoto} 
                alt="Your animated selfie with effects" 
                style={{
                  maxWidth: '80px',
                  maxHeight: '60px',
                  height: 'auto',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoCall;