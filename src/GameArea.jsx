    import React, { useState, useRef, useEffect } from 'react';
    import {
    GAME_SIZE,
    TARGET_SIZE,
    CURSOR_SIZE,
    CENTER_THRESHOLD,
    START_POSITION,
    TARGET_POSITIONS,
    CENTER_HOLD_TIME,
    TARGET_HOLD_TIME
    } from './constants';
    
    const GameArea = ({ 
        onTrialComplete, 
        isMirrorMode, 
        isResearcherMode,
        showPaths,
        paths,
        currentPath,
        onPathUpdate,
        unitConverter,  // Added
        participantId,  // Added
        inputDevice     // Added
      }) => {
    // Core state
    const [cursorPos, setCursorPos] = useState(START_POSITION);
    const [target, setTarget] = useState(null);
    const [gameState, setGameState] = useState('waiting');
    const [holdStartTime, setHoldStartTime] = useState(null);
    const [message, setMessage] = useState('Move to the center circle and hold.');
    const [holdProgress, setHoldProgress] = useState(0);
    const lastFrameTime = useRef(performance.now());
    const trialCount = useRef(0);

    // Refs for timing
    const gameRef = useRef(null);
    const trialStartTime = useRef(null);
    const movementStarted = useRef(false);
    const holdTimer = useRef(null);
    const centerHoldTimer = useRef(null);

    const isInCenter = (pos) => {
        if (!pos) return false;
        const distance = Math.sqrt(
        Math.pow(pos.x - START_POSITION.x, 2) + 
        Math.pow(pos.y - START_POSITION.y, 2)
        );
        return distance < CENTER_THRESHOLD;
    };

    const isOverTarget = (pos) => {
        if (!target || !pos) return false;
        const targetPos = TARGET_POSITIONS[target];
        const distance = Math.sqrt(
        Math.pow(pos.x - (targetPos.x + TARGET_SIZE/2), 2) + 
        Math.pow(pos.y - (targetPos.y + TARGET_SIZE/2), 2)
        );
        return distance < TARGET_SIZE/2;
    };

    const handleMouseMove = (e) => {
        if (!gameRef.current) return;
        const rect = gameRef.current.getBoundingClientRect();
        let x = e.clientX - rect.left - CURSOR_SIZE / 2;
        let y = e.clientY - rect.top - CURSOR_SIZE / 2;

        if (isMirrorMode) {
        x = GAME_SIZE - x - CURSOR_SIZE;
        y = GAME_SIZE - y - CURSOR_SIZE;
        }

        x = Math.max(0, Math.min(x, GAME_SIZE - CURSOR_SIZE));
        y = Math.max(0, Math.min(y, GAME_SIZE - CURSOR_SIZE));

        const newPos = { x, y };
        setCursorPos(newPos);

        // Track path during movement phase
        if (gameState === 'moving' && trialStartTime.current) {
        const pathPos = { 
            ...newPos,
            time: performance.now() - trialStartTime.current,
            isInTarget: isOverTarget(newPos)
        };
        onPathUpdate([...currentPath, pathPos]);
        }

        // Debug logging
        console.log({
        gameState,
        isInCenter: isInCenter(newPos),
        hasHoldTimer: !!centerHoldTimer.current,
        holdStartTime
        });
    };

    // Center hold logic - simplified and more robust
    // Center hold logic - modified to be more robust
    useEffect(() => {
        // Only set up the timer if we're in holding state and in center
        if (gameState === 'holding' && isInCenter(cursorPos)) {
        console.log('Setting up center hold timer');
        
        // Create new timer
        centerHoldTimer.current = setTimeout(() => {
            console.log('Center hold timer completed');
            if (isInCenter(cursorPos) && gameState === 'holding') {
            console.log('Showing target');
            showTarget();
            }
        }, CENTER_HOLD_TIME);
    
        // Cleanup on unmount or state change
        return () => {
            if (centerHoldTimer.current) {
            console.log('Cleaning up center hold timer');
            clearTimeout(centerHoldTimer.current);
            centerHoldTimer.current = null;
            }
        };
        }
    }, [gameState, cursorPos]);
    
    // Separate effect for state transitions
    useEffect(() => {
        if (gameState === 'waiting' && isInCenter(cursorPos)) {
        console.log('Transitioning to holding state');
        setGameState('holding');
        setHoldStartTime(Date.now());
        setMessage('Hold position...');
        } else if (gameState === 'holding' && !isInCenter(cursorPos)) {
        console.log('Lost center position, returning to waiting');
        setGameState('waiting');
        setHoldStartTime(null);
        setMessage('Move back to the center circle and hold.');
        }
    }, [cursorPos, gameState]);
    
    // Add debugging to showTarget
    const showTarget = () => {
        console.log('showTarget called');
        const positions = Object.keys(TARGET_POSITIONS);
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        
        console.log('Selected target position:', randomPosition);
        trialStartTime.current = performance.now();
        movementStarted.current = false;
        onPathUpdate([]);
        
        setTarget(randomPosition);
        setGameState('moving');
        setMessage('Move to the target and hold.');
    };



    const calculateVelocity = (pos1, pos2, dt) => {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance / dt; // pixels per millisecond
    };
    
    const calculatePeakVelocity = (path) => {
        if (path.length < 2) return 0;
        
        let peakVelocity = 0;
        for (let i = 1; i < path.length; i++) {
        const dt = path[i].time - path[i-1].time;
        const velocity = calculateVelocity(path[i-1], path[i], dt);
        if (velocity > peakVelocity) {
            peakVelocity = velocity;
        }
        }
        return peakVelocity;
    };
    
    const calculateReactionTime = (path) => {
        if (path.length < 2) return null;
        
        // Calculate peak velocity first
        const peakVelocity = calculatePeakVelocity(path);
        const velocityThreshold = peakVelocity * 0.10; // 20% of peak velocity
        
        // Find first point where velocity exceeds threshold
        for (let i = 1; i < path.length; i++) {
        const dt = path[i].time - path[i-1].time;
        const velocity = calculateVelocity(path[i-1], path[i], dt);
        
        if (velocity > velocityThreshold) {
            return path[i].time;
        }
        }
        
        return null;
    };

    const getSystemInfo = () => {
        return {
        screenRefreshRate: window.screen.refreshRate || 60,
        devicePixelRatio: window.devicePixelRatio,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        screenSize: { // Physical size if available
            width: window.screen.width / window.devicePixelRatio,
            height: window.screen.height / window.devicePixelRatio
        },
        userAgent: window.navigator.userAgent,
        platform: window.navigator.platform,
        // Browser performance
        frameRate: calculateFrameRate(),
        mouseSamplingRate: calculateMouseSamplingRate()
        };
    };
    
    const calculateFrameRate = () => {
        return 1000 / (performance.now() - lastFrameTime.current);
    };
    
    const calculateMouseSamplingRate = () => {
        if (currentPath.length < 2) return null;
        const intervals = [];
        for (let i = 1; i < currentPath.length; i++) {
        intervals.push(currentPath[i].time - currentPath[i-1].time);
        }
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        return medianInterval ? Math.round(1000 / medianInterval) : null;
    };
    
    // Target hold check
    useEffect(() => {
        if (!target || gameState !== 'moving') return;

        const isInTarget = isOverTarget(cursorPos);
        
        if (isInTarget && !holdStartTime) {
        setHoldStartTime(Date.now());
        } else if (!isInTarget && holdStartTime) {
        setHoldStartTime(null);
        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
        }

        if (holdStartTime && isInTarget) {
        if (holdTimer.current) clearTimeout(holdTimer.current);
        
        holdTimer.current = setTimeout(() => {
            const trialData = {
                // System/Hardware Info
                systemInfo: getSystemInfo(),
                
                // Trial Info
                trialNumber: trialCount.current++,
                condition: isMirrorMode ? 'mirror' : 'normal',
                participantId,
                inputDevice,
                
                // Spatial Parameters with unit conversion
                gameSize: unitConverter ? {
                  pixels: GAME_SIZE,
                  mm: unitConverter.pxToMm(GAME_SIZE)
                } : { pixels: GAME_SIZE },
                
                targetSize: unitConverter ? {
                  pixels: TARGET_SIZE,
                  mm: unitConverter.pxToMm(TARGET_SIZE)
                } : { pixels: TARGET_SIZE },
                
                cursorSize: unitConverter ? {
                  pixels: CURSOR_SIZE,
                  mm: unitConverter.pxToMm(CURSOR_SIZE)
                } : { pixels: CURSOR_SIZE },
                
                centerThreshold: unitConverter ? {
                  pixels: CENTER_THRESHOLD,
                  mm: unitConverter.pxToMm(CENTER_THRESHOLD)
                } : { pixels: CENTER_THRESHOLD },
                
                // Time Parameters
                centerHoldTime: CENTER_HOLD_TIME,
                targetHoldTime: TARGET_HOLD_TIME,
                
                // Trial Data
                targetPosition: target,
                startTime: trialStartTime.current,
                path: currentPath.map(point => ({
                  ...point,
                  ...(unitConverter ? {
                    x_mm: unitConverter.pxToMm(point.x),
                    y_mm: unitConverter.pxToMm(point.y)
                  } : {}),
                  timestamp: new Date(trialStartTime.current + point.time).toISOString()
                })),
                
                // Performance Data
                targetHoldDuration: Date.now() - holdStartTime,
                pathSamplingRate: calculateMouseSamplingRate(),
              
                // Calibration Info (if available)
                ...(unitConverter ? {
                  calibration: {
                    pixelsPerMM: unitConverter.pixelsPerMM,
                    timestamp: new Date().toISOString()
                  }
                } : {})
              };
            
            console.log('Trial complete:', trialData);
            onTrialComplete(trialData);
            
            // Reset for next trial
            setTarget(null);
            setGameState('waiting');
            setHoldStartTime(null);
            setMessage('Move to the center circle for next trial.');
        }, TARGET_HOLD_TIME);
        }

        return () => {
        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
        }
        };
    }, [cursorPos, target, holdStartTime, gameState]);

    // Hold progress animation
    useEffect(() => {
        let animationFrame;
        
        const updateProgress = () => {
        if (holdStartTime) {
            const elapsed = Date.now() - holdStartTime;
            const duration = gameState === 'holding' ? CENTER_HOLD_TIME : TARGET_HOLD_TIME;
            setHoldProgress(Math.min(elapsed / duration, 1));
            animationFrame = requestAnimationFrame(updateProgress);
        } else {
            setHoldProgress(0);
        }
        };

        if (holdStartTime) {
        animationFrame = requestAnimationFrame(updateProgress);
        }

        return () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [holdStartTime, gameState]);

    return (
        <div className="space-y-4">
        <div className="h-[50px]">
            <p className="text-center text-gray-600">{message}</p>
        </div>
        <div
            ref={gameRef}
            className="relative bg-white border-2 border-gray-300"
            style={{ width: GAME_SIZE, height: GAME_SIZE }}
            onMouseMove={handleMouseMove}
        >
            {/* Start position - always visible now */}
            <div
            className={`absolute rounded-full ${
                gameState === 'holding' ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{
                width: CURSOR_SIZE,
                height: CURSOR_SIZE,
                left: START_POSITION.x,
                top: START_POSITION.y,
            }}
            />

            {/* Target */}
            {target && (
            <div
                className={`absolute rounded-full ${
                holdStartTime ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{
                width: TARGET_SIZE,
                height: TARGET_SIZE,
                left: TARGET_POSITIONS[target].x,
                top: TARGET_POSITIONS[target].y,
                transition: 'background-color 200ms'
                }}
            >
                {holdStartTime && (
                <svg
                    className="absolute top-0 left-0"
                    width={TARGET_SIZE}
                    height={TARGET_SIZE}
                    viewBox={`0 0 ${TARGET_SIZE} ${TARGET_SIZE}`}
                    style={{ transform: 'rotate(-90deg)' }}
                >
                    <circle
                    cx={TARGET_SIZE / 2}
                    cy={TARGET_SIZE / 2}
                    r={(TARGET_SIZE / 2) - 2}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * ((TARGET_SIZE / 2) - 2)}`}
                    strokeDashoffset={`${(1 - holdProgress) * 2 * Math.PI * ((TARGET_SIZE / 2) - 2)}`}
                    />
                </svg>
                )}
            </div>
            )}

            {/* Cursor */}
            <div
            className="absolute bg-blue-500 rounded-full"
            style={{
                width: CURSOR_SIZE,
                height: CURSOR_SIZE,
                left: cursorPos.x,
                top: cursorPos.y,
                transform: 'translate(0, 0)',
                transition: 'transform 0ms linear'
            }}
            />

            {/* Path visualization */}
            {showPaths && currentPath.length > 0 && (
            <svg className="absolute top-0 left-0" width={GAME_SIZE} height={GAME_SIZE}>
                <path
                d={`M ${currentPath[0].x + CURSOR_SIZE / 2} ${currentPath[0].y + CURSOR_SIZE / 2} ${
                    currentPath.map(p => `L ${p.x + CURSOR_SIZE / 2} ${p.y + CURSOR_SIZE / 2}`).join(' ')
                }`}
                fill="none"
                stroke="rgba(255, 0, 0, 0.5)"
                strokeWidth="2"
                />
            </svg>
            )}
        </div>
        
        {/* Debug info */}
        {isResearcherMode && (
            <div className="mt-4 text-xs text-gray-600">
            <p>Game State: {gameState}</p>
            <p>Hold Time: {holdStartTime ? Date.now() - holdStartTime : 0}ms</p>
            <p>Is In Center: {isInCenter(cursorPos) ? 'Yes' : 'No'}</p>
            </div>
        )}
        </div>
    );
    };

    export default GameArea;