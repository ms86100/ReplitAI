import React from 'react';
import Lottie from 'lottie-react';

interface LottiePlayerProps {
  src: string | object;
  loop?: boolean;
  autoplay?: boolean;
  trigger?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const LottiePlayer: React.FC<LottiePlayerProps> = ({
  src,
  loop = false,
  autoplay = true,
  trigger,
  className,
  style
}) => {
  // For now, we'll use a placeholder since we don't have actual Lottie files
  // In a real implementation, you would load the Lottie JSON files
  const lottieData = typeof src === 'string' ? null : src;
  
  if (!lottieData && typeof src === 'string') {
    // Fallback for when we don't have the actual Lottie file
    return (
      <div 
        className={`flex items-center justify-center bg-gradient-to-br from-brand-primary/10 to-brand-accent/10 rounded-lg ${className}`}
        style={{ width: 120, height: 120, ...style }}
      >
        <div className="text-brand-primary font-medium text-sm">
          🎉 Animation
        </div>
      </div>
    );
  }

  return (
    <Lottie
      animationData={lottieData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      style={style}
    />
  );
};