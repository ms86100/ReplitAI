import React, { useEffect, useState } from 'react';
import { LottiePlayer } from './lottie-player';

interface CelebrationOverlayProps {
  show: boolean;
  onComplete?: () => void;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  show,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Confetti overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <LottiePlayer
          src="confetti_clap" 
          autoplay={true}
          loop={false}
          className="w-full h-full"
        />
      </div>
      
      {/* Hearts floating */}
      <div className="absolute inset-0 flex items-center justify-center">
        <LottiePlayer
          src="hearts_float"
          autoplay={true}
          loop={false}
          className="w-64 h-64"
        />
      </div>
    </div>
  );
};