import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function RedirectPage() {
  const [countdown, setCountdown] = useState(3);
  const [showSkip, setShowSkip] = useState(false);
  const [destination, setDestination] = useState(null);
  const [error, setError] = useState(null);
  
  // Get destination from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const dest = urlParams.get('destination');
      
      if (!dest) {
        setError('Invalid redirect URL. No destination parameter provided.');
        return;
      }
      
      // Validate URL
      try {
        new URL(dest);
        setDestination(dest);
      } catch (e) {
        setError('Invalid redirect URL format.');
      }
    }
  }, []);

  // Countdown timer and auto-redirect
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

  const handleSkip = () => {
    if (destination) {
      window.location.href = destination;
    }
  };

  // Error state
  if (error || !destination) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Redirect Error
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error || 'Invalid redirect URL. No destination parameter provided.'}
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-4">
      <div className="max-w-2xl w-full">
        {/* Main Content Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Loading Animation */}
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-16 w-16 text-violet-600 dark:text-violet-400 animate-spin" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Redirecting you in {countdown} second{countdown !== 1 ? 's' : ''}...
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Please wait while we redirect you to your destination
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-32 w-32 rounded-full border-4 border-violet-200 dark:border-violet-800 animate-pulse"></div>
              </div>
              <div className="relative flex items-center justify-center h-32 w-32">
                <span className="text-6xl font-bold text-violet-600 dark:text-violet-400 animate-in zoom-in duration-300">
                  {countdown}
                </span>
              </div>
            </div>
          </div>

          {/* Skip Button */}
          {showSkip && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Button
                onClick={handleSkip}
                className="w-full md:w-auto px-8 py-6 text-lg bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                Skip Ad →
              </Button>
            </div>
          )}

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 transition-all duration-1000 ease-linear"
              style={{ width: `${((3 - countdown) / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-white/80 text-sm">
            You will be redirected automatically. If not, click the button above.
          </p>
        </div>
      </div>
    </div>
  );
}
