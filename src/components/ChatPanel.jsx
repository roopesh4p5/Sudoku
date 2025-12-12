import { useState, useRef, useEffect } from 'react';
import { CloseIcon, SendIcon, MicIcon, StopIcon, PlayIcon } from './Icons';

const ChatPanel = ({
    isOpen,
    onClose,
    messages,
    onSendMessage,
    onSendVoice,
    playerId,
    playerName,
    ws
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
    const [peerIsSpeaking, setPeerIsSpeaking] = useState(false);
    const [audioPlaying, setAudioPlaying] = useState(null);
    const messagesEndRef = useRef(null);

    // WebRTC refs for live voice
    const localStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const remoteAudioRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    // Set up WebRTC signaling handlers
    useEffect(() => {
        if (!ws) return;

        ws.setMessageHandler('onVoiceOffer', async (data) => {
            if (data.senderId === playerId) return;

            try {
                await setupPeerConnection();
                await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(data.offer)
                );
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);

                ws.send({ type: 'voice_answer', answer });
            } catch (e) {
                console.error('Error handling voice offer:', e);
            }
        });

        ws.setMessageHandler('onVoiceAnswer', async (data) => {
            if (data.senderId === playerId) return;

            try {
                await peerConnectionRef.current?.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );
            } catch (e) {
                console.error('Error handling voice answer:', e);
            }
        });

        ws.setMessageHandler('onVoiceIceCandidate', async (data) => {
            if (data.senderId === playerId) return;

            try {
                await peerConnectionRef.current?.addIceCandidate(
                    new RTCIceCandidate(data.candidate)
                );
            } catch (e) {
                console.error('Error adding ICE candidate:', e);
            }
        });

        ws.setMessageHandler('onVoiceStart', (data) => {
            if (data.senderId !== playerId) {
                setPeerIsSpeaking(true);
            }
        });

        ws.setMessageHandler('onVoiceStop', (data) => {
            if (data.senderId !== playerId) {
                setPeerIsSpeaking(false);
            }
        });
    }, [ws, playerId]);

    const setupPeerConnection = async () => {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        peerConnectionRef.current = new RTCPeerConnection(configuration);

        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate && ws) {
                ws.send({
                    type: 'voice_ice_candidate',
                    candidate: event.candidate
                });
            }
        };

        peerConnectionRef.current.ontrack = (event) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
                remoteAudioRef.current.play().catch(() => { });
            }
        };

        return peerConnectionRef.current;
    };

    const startLiveVoice = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            await setupPeerConnection();

            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
            });

            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);

            if (ws) {
                ws.send({ type: 'voice_offer', offer });
                ws.send({ type: 'voice_start' });
            }

            setIsLiveVoiceActive(true);
        } catch (e) {
            console.error('Error starting live voice:', e);
        }
    };

    const stopLiveVoice = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (ws) {
            ws.send({ type: 'voice_stop' });
        }

        setIsLiveVoiceActive(false);
    };

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const playVoiceMessage = (audioData, messageId) => {
        if (audioPlaying === messageId) {
            setAudioPlaying(null);
            return;
        }

        const audio = new Audio(audioData);
        audio.onended = () => setAudioPlaying(null);
        audio.play();
        setAudioPlaying(messageId);
    };

    return (
        <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
            {/* Hidden audio element for receiving live voice */}
            <audio ref={remoteAudioRef} autoPlay />

            <div className="chat-header">
                <h3>Chat</h3>
                {peerIsSpeaking && (
                    <div className="peer-speaking">
                        <div className="speaking-indicator">
                            <span className="speaking-dot"></span>
                            <span className="speaking-dot"></span>
                            <span className="speaking-dot"></span>
                        </div>
                        <span>Opponent speaking...</span>
                    </div>
                )}
                <button className="chat-close btn-icon btn-ghost" onClick={onClose}>
                    <CloseIcon />
                </button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No messages yet
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`chat-message ${msg.senderId === playerId ? 'own' : 'other'} ${msg.isVoice ? 'voice' : ''}`}
                        >
                            {msg.senderId !== playerId && (
                                <div className="chat-message-sender">{msg.senderName}</div>
                            )}
                            {msg.isVoice ? (
                                <button
                                    className="voice-play-btn"
                                    onClick={() => playVoiceMessage(msg.audioData, index)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'none',
                                        border: 'none',
                                        color: 'inherit',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {audioPlaying === index ? <StopIcon /> : <PlayIcon />}
                                    <div className="voice-indicator">
                                        <div className="voice-bar" style={{ height: '8px' }}></div>
                                        <div className="voice-bar" style={{ height: '14px' }}></div>
                                        <div className="voice-bar" style={{ height: '10px' }}></div>
                                        <div className="voice-bar" style={{ height: '16px' }}></div>
                                        <div className="voice-bar" style={{ height: '12px' }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voice</span>
                                </button>
                            ) : (
                                <div className="chat-message-content">{msg.content}</div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Type a message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                />

                {/* Live Voice Button */}
                <button
                    className={`voice-btn live ${isLiveVoiceActive ? 'active' : ''}`}
                    onMouseDown={startLiveVoice}
                    onMouseUp={stopLiveVoice}
                    onMouseLeave={stopLiveVoice}
                    onTouchStart={startLiveVoice}
                    onTouchEnd={stopLiveVoice}
                    title="Hold to speak"
                >
                    <MicIcon />
                    {isLiveVoiceActive && (
                        <span className="live-indicator"></span>
                    )}
                </button>

                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                >
                    <SendIcon />
                </button>
            </div>
        </div>
    );
};

export default ChatPanel;
