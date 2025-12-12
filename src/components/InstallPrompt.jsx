import { useState, useEffect } from 'react';
import { DownloadIcon, CloseIcon } from './Icons';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="install-prompt">
            <div className="install-prompt-text">
                <div className="install-prompt-title">Install Sudoku Duel</div>
                <div className="install-prompt-subtitle">Add to home screen for quick access</div>
            </div>
            <div className="install-prompt-actions">
                <button className="btn btn-ghost btn-icon" onClick={handleDismiss}>
                    <CloseIcon />
                </button>
                <button className="btn btn-primary" onClick={handleInstall}>
                    <DownloadIcon />
                    Install
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
