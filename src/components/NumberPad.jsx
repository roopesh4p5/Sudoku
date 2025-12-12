import { useState, useRef, useEffect } from 'react';
import { MicIcon } from './Icons';

const NumberPad = ({
    onNumberSelect,
    onClear,
    disabled,
    usedNumbers = {},
    hideClear = false,
    showVoice = false,
    ws = null
}) => {
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [peerIsSpeaking, setPeerIsSpeaking] = useState(false);

    // WebRTC refs for live voice (walkie-talkie style)
    const localStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const peerSpeakingTimeoutRef = useRef(null);

    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    // Set up WebRTC signaling handlers
    useEffect(() => {
        if (!ws || !showVoice) return;

        ws.setMessageHandler('onVoiceOffer', async (data) => {
            if (data.senderId === ws.playerId) return;

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
            if (data.senderId === ws.playerId) return;

            try {
                await peerConnectionRef.current?.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );
            } catch (e) {
                console.error('Error handling voice answer:', e);
            }
        });

        ws.setMessageHandler('onVoiceIceCandidate', async (data) => {
            if (data.senderId === ws.playerId) return;

            try {
                await peerConnectionRef.current?.addIceCandidate(
                    new RTCIceCandidate(data.candidate)
                );
            } catch (e) {
                console.error('Error adding ICE candidate:', e);
            }
        });

        ws.setMessageHandler('onVoiceStart', (data) => {
            if (data.senderId !== ws.playerId) {
                setPeerIsSpeaking(true);
                if (peerSpeakingTimeoutRef.current) {
                    clearTimeout(peerSpeakingTimeoutRef.current);
                }
            }
        });

        ws.setMessageHandler('onVoiceStop', (data) => {
            if (data.senderId !== ws.playerId) {
                peerSpeakingTimeoutRef.current = setTimeout(() => {
                    setPeerIsSpeaking(false);
                }, 500);
            }
        });

        return () => {
            if (peerSpeakingTimeoutRef.current) {
                clearTimeout(peerSpeakingTimeoutRef.current);
            }
        };
    }, [ws, showVoice]);

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

    const startVoice = async (e) => {
        e.preventDefault();
        if (!showVoice || !ws) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            localStreamRef.current = stream;

            await setupPeerConnection();

            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
            });

            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);

            ws.send({ type: 'voice_offer', offer });
            ws.send({ type: 'voice_start' });

            setIsVoiceActive(true);
        } catch (e) {
            console.error('Error starting voice:', e);
            alert('Microphone access denied or not available');
        }
    };

    const stopVoice = (e) => {
        e?.preventDefault();

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

        setIsVoiceActive(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, []);

    return (
        <div className="number-pad">
            {/* Hidden audio element for receiving live voice */}
            <audio ref={remoteAudioRef} autoPlay />

            <div className="number-row">
                {numbers.slice(0, 5).map(num => (
                    <button
                        key={num}
                        className={`number-btn ${disabled ? 'disabled' : ''} ${usedNumbers[num] >= 9 ? 'disabled' : ''}`}
                        onClick={() => !disabled && onNumberSelect(num)}
                        disabled={disabled || usedNumbers[num] >= 9}
                    >
                        {num}
                    </button>
                ))}
            </div>
            <div className="number-row">
                {numbers.slice(5).map(num => (
                    <button
                        key={num}
                        className={`number-btn ${disabled ? 'disabled' : ''} ${usedNumbers[num] >= 9 ? 'disabled' : ''}`}
                        onClick={() => !disabled && onNumberSelect(num)}
                        disabled={disabled || usedNumbers[num] >= 9}
                    >
                        {num}
                    </button>
                ))}

                {/* Voice button or Clear button */}
                {showVoice ? (
                    <button
                        className={`number-btn voice-pad-btn ${isVoiceActive ? 'active' : ''} ${peerIsSpeaking ? 'peer-speaking' : ''}`}
                        onMouseDown={startVoice}
                        onMouseUp={stopVoice}
                        onMouseLeave={stopVoice}
                        onTouchStart={startVoice}
                        onTouchEnd={stopVoice}
                        title="Hold to speak (walkie-talkie)"
                    >
                        <MicIcon />
                        {isVoiceActive && <span className="voice-active-indicator"></span>}
                        {peerIsSpeaking && <span className="voice-peer-indicator"></span>}
                    </button>
                ) : !hideClear && (
                    <button
                        className={`number-btn clear ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && onClear()}
                        disabled={disabled}
                    >
                        CLR
                    </button>
                )}
            </div>
        </div>
    );
};

export default NumberPad;
