import { useState, useEffect } from 'react';

const Toast = ({ message, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(onRemove, 3000);
        return () => clearTimeout(timer);
    }, [onRemove]);

    return (
        <div className="toast">
            <div className="toast-header">
                <span className="toast-sender">{message.senderName}</span>
            </div>
            <div className="toast-content">
                {message.isVoice ? 'Sent a voice message' : message.content}
            </div>
        </div>
    );
};

const ToastContainer = ({ toasts, onRemoveToast }) => {
    return (
        <div className="toast-container">
            {toasts.map((toast, index) => (
                <Toast
                    key={index}
                    message={toast}
                    onRemove={() => onRemoveToast(index)}
                />
            ))}
        </div>
    );
};

export default ToastContainer;
