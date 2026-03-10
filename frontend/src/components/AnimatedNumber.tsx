import React, { useState, useEffect } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 1500, prefix = '', suffix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            // ease-out cubic for a smooth deceleration
            const easeOutCubic = 1 - Math.pow(1 - percentage, 3);

            setDisplayValue(Math.floor(easeOutCubic * value));

            if (percentage < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setDisplayValue(value); // Ensure it lands exactly on the value
            }
        };

        // Only animate if value is greater than 0
        if (value > 0) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            setDisplayValue(value);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [value, duration]);

    return (
        <span>
            {prefix}{displayValue.toLocaleString()}{suffix}
        </span>
    );
};

export default AnimatedNumber;
