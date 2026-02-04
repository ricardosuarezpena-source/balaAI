
import React from 'react';
import { AlertCircle, RefreshCw, Flag, XCircle, WifiOff, KeyRound } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
  onReport?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, onReport }) => {
  // Categorize errors for better UX
  const getErrorInfo = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes('api_key') || lower.includes('key')) {
      return {
        title: 'Authentication Error',
        description: 'There seems to be an issue with your API configuration. Please check your credentials.',
        icon: <KeyRound className="w-6 h-6 text-amber-400" />,
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20'
      };
    }
    if (lower.includes('network') || lower.includes('fetch') || lower.includes('connect')) {
      return {
        title: 'Connection Lost',
        description: 'We couldn\'t reach the AI servers. Please check your internet connection and try again.',
        icon: <WifiOff className="w-6 h-6 text-blue-400" />,
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20'
      };
    }
    return {
      title: 'Something went wrong',
      description: error || 'An unexpected error occurred while processing your request.',
      icon: <XCircle className="w-6 h-6 text-red-400" />,
      bg: 'bg-red-500/10',
      border: 'border-red-500/20'
    };
  };

  const info = getErrorInfo(error);

  return (
    <div className={`mx-auto max-w-lg mt-8 p-6 ${info.bg} border ${info.border} rounded-2xl animate-in fade-in zoom-in-95 duration-300`}>
      <div className="flex gap-4">
        <div className="flex-shrink-0 mt-1">
          {info.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{info.title}</h3>
          <p className="text-sm text-gray-300 leading-relaxed mb-6">
            {info.description}
          </p>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium transition-all transform active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={onReport || (() => window.open('https://github.com', '_blank'))}
              className="flex items-center gap-2 px-4 py-2 bg-[#2f2f2f] text-gray-300 hover:bg-[#3c3c3c] hover:text-white rounded-lg text-sm font-medium transition-all"
            >
              <Flag className="w-4 h-4" />
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
