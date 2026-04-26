import { useEffect, useState } from 'react';
// @ts-expect-error - propushService.js is a JavaScript file without TypeScript declarations
import PropushService from '../services/propushService';

export default function RedirectPage() {
  const [countdown, setCountdown] = useState(3);
  const [showSkip, setShowSkip] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  
  // Get destination from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
      const dest = urlParams.get('destination');
      setDestination(dest);
    }
  }, []);

  useEffect(() => {
    if (!destination) return;

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = destination;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Show skip button after 2 seconds
    const skipTimer = setTimeout(() => setShowSkip(true), 2000);

    return () => {
      clearInterval(timer);
      clearTimeout(skipTimer);
    };
  }, [destination]);

  // Initialize Propush onclick ads
  useEffect(() => {
    PropushService.init();
  }, []); // Run once on mount

  const handleSkip = () => {
    if (destination) {
      window.location.href = destination;
    }
  };

  if (!destination) {
    return <div>Error: Invalid redirect URL</div>;
  }

  return (
    <div className="redirect-page">
      <div className="content">
        <h1>Redirecting you...</h1>
        <div className="countdown">{countdown}</div>
        <p>Please wait while we redirect you to your destination</p>

        {showSkip && (
          <button onClick={handleSkip} className="skip-btn">
            Skip Ad →
          </button>
        )}
      </div>
    </div>
  );
}

