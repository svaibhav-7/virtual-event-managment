import React, { useState, useEffect, useCallback } from "react";
import VideoCall from "./Videocall";

const Room = ({ roomId, username, setIsInRoom, socket }) => {
  const [messages, setMessages] = useState([]);
  const [mediaStream, setMediaStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [polls, setPolls] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [emojiReactions, setEmojiReactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const meetLink = `${window.location.origin}?roomId=${roomId}`;

  const sendMessage = useCallback(
    (message, isPrivate = false, recipient = null) => {
      const newMessage = {
        sender: username,
        text: message,
        timestamp: new Date().toLocaleTimeString(),
        isPrivate,
        recipient,
      };
      setMessages((prev) => [...prev, newMessage]);
      socket.emit("send-message", { roomId, message: newMessage });
    },
    [roomId, username, socket]
  );

  useEffect(() => {
    setWelcomeMessage(`Welcome, ${username}!`);
  }, [username]);

  // In Room.js
  const [publicMeetLink, setPublicMeetLink] = useState("");
  useEffect(() => {
    // For Glitch deployment, get the hostname from the browser
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : '';

    // Create the public link using the full URL
    const fullUrl = `${protocol}//${hostname}${port}?roomId=${roomId}`;
    setPublicMeetLink(fullUrl);

  }, [roomId]);

  const voteInPoll = (pollIndex, optionIndex) => {
    const updatedPolls = [...polls];
    const poll = updatedPolls[pollIndex];
    if (!poll.votes) poll.votes = {};
    if (!poll.votes[username]) poll.votes[username] = optionIndex;
    setPolls(updatedPolls);
    socket.emit("vote-poll", { roomId, pollIndex, optionIndex });
  };
  const createPoll = (question, options) => {
    const newPoll = {
      question,
      options: options.map((option) => ({ text: option.trim(), votes: 0 })),
    };
    setPolls((prev) => [...prev, newPoll]);
    setActivePoll(newPoll);
    socket.emit("create-poll", { roomId, poll: newPoll });
  };
  const sendEmojiReaction = (emoji) => {
    setEmojiReactions((prev) => [...prev, emoji]);
    socket.emit("send-emoji", { roomId, emoji });
  };
  const toggleRaiseHand = () => {
    if (raisedHands.includes(username)) {
      setRaisedHands((prev) => prev.filter((user) => user !== username));
      sendMessage(`✋ ${username} has lowered their hand.`);
    } else {
      setRaisedHands((prev) => [...prev, username]);
      sendMessage(`✋ ${username} has raised their hand.`);
    }
  };
  const handleEndCall = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setIsInRoom(false);
  };
  // Function to ensure audio tracks are properly set up
  const setupAudioTracks = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      });
      
      if (mediaStream) {
        // Remove any existing audio tracks
        const existingAudioTracks = mediaStream.getAudioTracks();
        existingAudioTracks.forEach(track => mediaStream.removeTrack(track));
        
        // Add new audio tracks
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = true;
          mediaStream.addTrack(track);
        });
      } else {
        setMediaStream(audioStream);
      }
      
      setIsMicOn(true);
      
      // Log audio track status
      console.log('Audio tracks set up:', mediaStream?.getAudioTracks().map(track => ({
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));
    } catch (error) {
      console.error('Audio setup error:', error);
      alert('Could not access microphone. Please check your permissions and connection.');
    }
  };

  // Modify toggleMic to use the new setup function
  const toggleMic = async () => {
    if (!mediaStream || mediaStream.getAudioTracks().length === 0) {
      await setupAudioTracks();
    } else {
      const audioTracks = mediaStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(!isMicOn);
    }
  };
  const toggleCamera = async () => {
    if (!mediaStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMediaStream(stream);
        setIsCameraOn(true);
        setIsMicOn(true);
      } catch (error) {
        alert("Camera access denied!");
      }
    } else {
      mediaStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn(!isCameraOn);
    }
  };
  useEffect(() => {
    const handleUserJoined = (user) => {
      if (user.userId !== socket.id) { // Don't add yourself again
        setUsers((prev) => [...prev, user.username]);
        setWelcomeMessage(`${user.username} has joined the room!`);
      }
    };
    const handleUserLeft = (user) => {
      setUsers((prev) => prev.filter((u) => u !== user.username));
      setWelcomeMessage(`${user.username} has left the room.`);
    };
    const handleExistingParticipants = (participants) => {
      setUsers(participants.map(p => p.username));
    };

    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("existing-participants", handleExistingParticipants);
    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });
    socket.on("receive-emoji", (emoji) => {
      setEmojiReactions((prev) => [...prev, emoji]);
    });
    socket.on("update-poll", (poll) => {
      setPolls((prevPolls) => {
        const updatedPolls = [...prevPolls];
        const pollIndex = updatedPolls.findIndex((p) => p.question === poll.question);
        if (pollIndex !== -1) updatedPolls[pollIndex] = poll;
        return updatedPolls;
      });
    });
    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("receive-message");
      socket.off("receive-emoji");
      socket.off("update-poll");
    };
  }, [socket]);
  return (
    <div className="roomContainer">
      {welcomeMessage && (
        <div className="welcomeMessage">
          {welcomeMessage}
        </div>
      )}
      {/* Video Call Component */}
      <VideoCall
  mediaStream={mediaStream}
  setMediaStream={setMediaStream}
  screenStream={screenStream}
  setScreenStream={setScreenStream}
  isCameraOn={isCameraOn}
  setIsCameraOn={setIsCameraOn}
  isMicOn={isMicOn}
  setIsMicOn={setIsMicOn}
  recorder={recorder}
  setRecorder={setRecorder}
  recordedChunks={recordedChunks}
  setRecordedChunks={setRecordedChunks}
  sendEmojiReaction={sendEmojiReaction}
  emojiReactions={emojiReactions}
  users={users}
  raisedHands={raisedHands}
  toggleRaiseHand={toggleRaiseHand}
  meetLink={publicMeetLink || meetLink}
  username={username}
  handleEndCall={handleEndCall}
  toggleMic={toggleMic}
  toggleCamera={toggleCamera}
  socket={socket}
  roomId={roomId}
  peerConnections={{}}
  setPeerConnections={() => {}}
/>
      {/* Chat Section */}
      <div className="chatSection">
        <div className="chatWindow">
          {messages.map((message, index) => (
            <div key={index} className="message">
              <span className="sender">{message.sender}:</span>{" "}
              <span className="text">{message.text}</span>{" "}
              <span className="timestamp">{message.timestamp}</span>
              {message.isPrivate && (
                <span className="private">(Private to {message.recipient})</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Polls Section */}
      <div className="polls">
        {activePoll && (
          <div className="poll">
            <h4>{activePoll.question}</h4>
            <ul>
              {activePoll.options.map((option, index) => (
                <li key={index}>
                  {option.text} - {option.votes} votes{" "}
                  <button onClick={() => voteInPoll(polls.indexOf(activePoll), index)}>
                    Vote
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => {
            const question = prompt("Enter poll question:");
            if (question) {
              const optionsInput = prompt("Enter poll options (comma separated):");
              if (optionsInput) {
                const options = optionsInput.split(",");
                createPoll(question, options);
              }
            }
          }}
          className="controlButton"
        >
          Poll
        </button>
      </div>
    </div>
  );
};

export default Room;