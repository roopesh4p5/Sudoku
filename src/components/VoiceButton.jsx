import { useState, useRef, useEffect } from 'react';
import { MicIcon } from './Icons';

const VoiceButton = ({ ws }) => {
    const [isActive, setIsActive] = useState(false);
    const [peerIsSpeaking, setPeerIsSpeaking] = useState(false);
    const localStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const remoteAudioRef = useRef(null);

    useEffect(() => {
        if (!ws) return;

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
            }
        });

        ws.setMessageHandler('onVoiceStop', (data) => {
            if (data.senderId !== ws.playerId) {
                setPeerIsSpeaking(false);
            }
        });
    }, [ws]);

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

    const startVoice = async () => {
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

            setIsActive(true);
        } catch (e) {
            console.error('Error starting voice:', e);
        }
    };

    const stopVoice = () => {
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

        setIsActive(false);
    };

    return (
        <>
            <audio ref={remoteAudioRef} autoPlay />
            <button
                className={`voice-game-btn ${isActive ? 'active' : ''} ${peerIsSpeaking ? 'peer-speaking' : ''}`}
                onMouseDown={startVoice}
                onMouseUp={stopVoice}
                onMouseLeave={stopVoice}
                onTouchStart={startVoice}
                onTouchEnd={stopVoice}
                title="Hold to speak"
            >
                <MicIcon />
                {isActive && <span className="voice-active-indicator"></span>}
                {peerIsSpeaking && <span className="peer-speaking-indicator"></span>}
            </button>
        </>
    );
};

export default VoiceButton;
