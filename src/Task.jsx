import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import confetti from 'canvas-confetti';
import Calibration from './Calibration';

const GAME_SIZE = 350;
const TARGET_SIZE = 30;
const CURSOR_SIZE = 15;
const CENTER_THRESHOLD = 10;
const EDGE_BUFFER = 10;
const START_POSITION = { x: GAME_SIZE / 2 - CURSOR_SIZE / 2, y: GAME_SIZE / 2 - CURSOR_SIZE / 2 };
const COLLECTION_INTERVAL = 10;
const TARGET_DELAY = 500; // Changed to 500ms as requested
const DEFAULT_TRIALS = 20; // Default number of trials

const VELOCITY_THRESHOLD = 50; // pixels/second for movement initiation
const STOPPING_THRESHOLD = 10; // pixels/second for considering movement stopped
const CREDIT_CARD_LENGTH_MM = 85.6;

const euclideanDistance = (p1, p2) => 
  Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

const calculateVelocity = (p1, p2, timeDiff) => 
  euclideanDistance(p1, p2) / (timeDiff / 1000);


// URL parameter handling
const getUrlParams = () => {
  // Try to get params from both regular URL and hash
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  
  // Use URL params first, then hash params, then defaults
  const trials = parseInt(urlParams.get('trials')) || 
                 parseInt(hashParams.get('trials')) || 
                 DEFAULT_TRIALS;
  
  const conditions = urlParams.get('conditions')?.split(',') || 
                    hashParams.get('conditions')?.split(',') || 
                    ['regular', 'mirror', 'decoupled', 'decoupledMirror'];
  
  console.log('Parsed URL params:', { trials, conditions }); // For debugging
  return { trials, conditions };
};

const TARGET_POSITIONS = {
  top: { x: GAME_SIZE / 2 - TARGET_SIZE / 2, y: EDGE_BUFFER },
  bottom: { x: GAME_SIZE / 2 - TARGET_SIZE / 2, y: GAME_SIZE - TARGET_SIZE - EDGE_BUFFER },
  left: { x: EDGE_BUFFER, y: GAME_SIZE / 2 - TARGET_SIZE / 2 },
  right: { x: GAME_SIZE - TARGET_SIZE - EDGE_BUFFER, y: GAME_SIZE / 2 - TARGET_SIZE / 2 },
};

export default function CognitiveMotorTask() {
  const [participantId, setParticipantId] = useState('');
  const [inputDevice, setInputDevice] = useState('');
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [userType, setUserType] = useState('');
  const [cursorPos, setCursorPos] = useState(START_POSITION);
  const [target, setTarget] = useState(null);
  const [gameState, setGameState] = useState('waiting');
  const [stats, setStats] = useState({ hits: 0, misses: 0, avgTime: 0 });
  const [isMirrorMode, setIsMirrorMode] = useState(false);
  const [isDecoupledMode, setIsDecoupledMode] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [kinematicMetrics, setKinematicMetrics] = useState({
    reactionTime: [], movementTime: [], peakVelocity: [], timeTopeakVelocity: [],
    pathLength: [], directnessRatio: [], movementVariability: [], endpointError: [], movementUnits: [],
    ballisticMovementTime: [], ballisticPathLength: [], correctiveMovements: [],
    directionReversals: [], absoluteError: [], variableError: [],
    fullPathLength: [], percentageDirectionReversals: [],
    movementType: []

  });
  const [currentCondition, setCurrentCondition] = useState(0);
  const [trialsCompleted, setTrialsCompleted] = useState(0);
  const [isTaskComplete, setIsTaskComplete] = useState(false);
  const gameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastCollectionTime = useRef(0);
  const lastPos = useRef(START_POSITION);
  const velocities = useRef([]);
  const accelerations = useRef([]);
  const [showStartPosition, setShowStartPosition] = useState(true);

  const [showCalibration, setShowCalibration] = useState(false);
  const [pixelsPerMM, setPixelsPerMM] = useState(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const [urlParams] = useState(getUrlParams());
  const TRIALS_PER_CONDITION = urlParams.trials;

  // Modified conditions based on URL parameters
  const conditions = urlParams.conditions.map(condition => {
    switch(condition.toLowerCase()) {
      case 'regular':
        return { name: 'Regular', mirror: false, decoupled: false };
      case 'mirror':
        return { name: 'Mirror', mirror: true, decoupled: false };
      case 'decoupled':
        return { name: 'Decoupled', mirror: false, decoupled: true, requiresTouchscreen: true };
      case 'decoupledmirror':
        return { name: 'Decoupled Mirror', mirror: true, decoupled: true, requiresTouchscreen: true };
      default:
        return null;
    }
  }).filter(Boolean);


  const getAvailableConditions = () => {
    return conditions.filter(condition => !condition.requiresTouchscreen || inputDevice === 'touchscreen');
  };

  useEffect(() => {
    if (gameState === 'active' && target) {
      checkCollision();
    }
  }, [cursorPos, gameState, target]);

  useEffect(() => {
    let intervalId;
    if (gameState === 'active') {
      intervalId = setInterval(() => {
        const now = Date.now();
        const newPos = { ...cursorPos, time: now - startTimeRef.current };
        setCurrentPath(prevPath => [...prevPath, newPos]);
        updateKinematicData(newPos);
      }, COLLECTION_INTERVAL);
    }
    return () => clearInterval(intervalId);
  }, [gameState, cursorPos]);

  const updateKinematicData = (newPos) => {
    const dt = (newPos.time - lastPos.current.time) / 1000; // Time step in seconds
    const velocity = calculateVelocity(lastPos.current, newPos, newPos.time - lastPos.current.time);
    velocities.current.push(velocity);
  
    if (velocities.current.length > 1) {
      const acceleration = (velocity - velocities.current[velocities.current.length - 2]) / dt;
      accelerations.current.push(acceleration);
    }
  
    lastPos.current = newPos;
  };

  const calculateKinematicMetrics = () => {
    const movementStartIndex = currentPath.findIndex((point, index) => {
      if (index === 0) return false;
      const velocity = calculateVelocity(currentPath[index - 1], point, point.time - currentPath[index - 1].time);
      return velocity > VELOCITY_THRESHOLD;
    });
  
    const reactionTime = currentPath[movementStartIndex]?.time || 0;
    const movementTime = currentPath[currentPath.length - 1].time - reactionTime;
    const movementType = isMirrorMode ? 'Mirrored' : 'Direct';

    // Calculate ballistic movement time and path length
    let ballisticEndIndex = movementStartIndex;
    for (let i = movementStartIndex + 1; i < currentPath.length; i++) {
      const velocity = calculateVelocity(currentPath[i-1], currentPath[i], currentPath[i].time - currentPath[i-1].time);
      if (velocity < STOPPING_THRESHOLD) {
        ballisticEndIndex = i;
        break;
      }
    }
    const ballisticMovementTime = currentPath[ballisticEndIndex].time - reactionTime;
    
    let fullPathLength = 0;
    let ballisticPathLength = 0;
    for (let i = 1; i < currentPath.length; i++) {
      const segmentLength = euclideanDistance(currentPath[i-1], currentPath[i]);
      fullPathLength += segmentLength;
      if (i <= ballisticEndIndex) {
        ballisticPathLength += segmentLength;
      }
    }
    
    const peakVelocity = Math.max(...velocities.current);
    const timeTopeakVelocity = velocities.current.indexOf(peakVelocity) * COLLECTION_INTERVAL;
    
    const startToEndDistance = euclideanDistance(currentPath[0], currentPath[currentPath.length - 1]);
    const directnessRatio = startToEndDistance / fullPathLength;
  
    const avgX = currentPath.reduce((sum, pos) => sum + pos.x, 0) / currentPath.length;
    const avgY = currentPath.reduce((sum, pos) => sum + pos.y, 0) / currentPath.length;
    const movementVariability = currentPath.reduce((sum, pos) => 
      sum + euclideanDistance(pos, {x: avgX, y: avgY}), 0) / currentPath.length;
  
    const targetPos = TARGET_POSITIONS[target];
    const endpointError = euclideanDistance(currentPath[currentPath.length - 1], targetPos);
  
    let movementUnits = 1;
    let correctiveMovements = 0;
    let directionReversals = 0;
    for (let i = 1; i < accelerations.current.length; i++) {
      if (accelerations.current[i-1] < 0 && accelerations.current[i] > 0) {
        movementUnits++;
        correctiveMovements++;
      }
      if ((velocities.current[i-1].x * velocities.current[i].x < 0) ||
          (velocities.current[i-1].y * velocities.current[i].y < 0)) {
        directionReversals++;
      }
    }

    const percentageDirectionReversals = (directionReversals / currentPath.length) * 100;
    
    // Calculate absolute error (distance from target center)
    const absoluteError = endpointError;
    
    // Calculate variable error (standard deviation of endpoint positions)
    const endX = currentPath[currentPath.length - 1].x;
    const endY = currentPath[currentPath.length - 1].y;
    const prevEndpoints = kinematicMetrics.endpointError.map((_, index) => ({
      x: currentPath[currentPath.length - 1].x,
      y: currentPath[currentPath.length - 1].y
    }));
    prevEndpoints.push({ x: endX, y: endY });
    const avgEndX = prevEndpoints.reduce((sum, pos) => sum + pos.x, 0) / prevEndpoints.length;
    const avgEndY = prevEndpoints.reduce((sum, pos) => sum + pos.y, 0) / prevEndpoints.length;
    const variableError = Math.sqrt(
      prevEndpoints.reduce((sum, pos) => 
        sum + Math.pow(pos.x - avgEndX, 2) + Math.pow(pos.y - avgEndY, 2), 0
      ) / prevEndpoints.length
    );

    setKinematicMetrics(prevMetrics => ({
      reactionTime: [...prevMetrics.reactionTime, reactionTime],
      movementTime: [...prevMetrics.movementTime, movementTime],
      peakVelocity: [...prevMetrics.peakVelocity, peakVelocity],
      timeTopeakVelocity: [...prevMetrics.timeTopeakVelocity, timeTopeakVelocity],
      pathLength: [...prevMetrics.pathLength, fullPathLength],
      directnessRatio: [...prevMetrics.directnessRatio, directnessRatio],
      movementVariability: [...prevMetrics.movementVariability, movementVariability],
      endpointError: [...prevMetrics.endpointError, endpointError],
      movementUnits: [...prevMetrics.movementUnits, movementUnits],
      ballisticMovementTime: [...prevMetrics.ballisticMovementTime, ballisticMovementTime],
      ballisticPathLength: [...prevMetrics.ballisticPathLength, ballisticPathLength],
      correctiveMovements: [...prevMetrics.correctiveMovements, correctiveMovements],
      directionReversals: [...prevMetrics.directionReversals, directionReversals],
      absoluteError: [...prevMetrics.absoluteError, absoluteError],
      variableError: [...prevMetrics.variableError, variableError],
      fullPathLength: [...prevMetrics.fullPathLength, fullPathLength],
      percentageDirectionReversals: [...prevMetrics.percentageDirectionReversals, percentageDirectionReversals],
      movementType: [...prevMetrics.movementType, movementType]

    }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (participantId.trim() === '') {
      setError('Please enter a valid Participant ID.');
      return;
    }
    if (!inputDevice) {
      setError('Please select an input device.');
      return;
    }
    if (!userType) {
      setError('Please select user type.');
      return;
    }
    setIsFormSubmitted(true);

    if (userType === 'participant') {
      const availableConditions = getAvailableConditions();
      setCurrentCondition(0);
      setIsMirrorMode(availableConditions[0].mirror);
      setIsDecoupledMode(availableConditions[0].decoupled);
    }
    setMessage(userType === 'participant' ? 'Task started. Move the cursor to the green circle to begin.' : 'Researcher mode activated. All controls are available.');
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

    setCursorPos({ x, y });

    if (gameState === 'waiting' && isInCenter(x, y)) {
      setGameState('ready');
      setMessage('Hold the cursor in the center. Target will appear shortly.');
      setTimeout(showRandomTarget, TARGET_DELAY);
    }
  };

  const isInCenter = (x, y) => {
    return (
      Math.abs(x - START_POSITION.x) < CENTER_THRESHOLD &&
      Math.abs(y - START_POSITION.y) < CENTER_THRESHOLD
    );
  };

 const showRandomTarget = () => {
    const positions = Object.keys(TARGET_POSITIONS);
    const randomPosition = positions[Math.floor(Math.random() * positions.length)];
    setTarget(randomPosition);
    setGameState('active');
    setShowStartPosition(false);
    startTimeRef.current = Date.now();
    lastCollectionTime.current = startTimeRef.current;
    setCurrentPath([]);
    velocities.current = [];
    accelerations.current = [];
    setMessage('Move to the red target as quickly as possible.');
  };

  const checkCollision = () => {
    const targetPos = TARGET_POSITIONS[target];
    if (
      cursorPos.x < targetPos.x + TARGET_SIZE &&
      cursorPos.x + CURSOR_SIZE > targetPos.x &&
      cursorPos.y < targetPos.y + TARGET_SIZE &&
      cursorPos.y + CURSOR_SIZE > targetPos.y
    ) {
      handleHit();
    }
  };

  const handleCalibrationComplete = (calculatedPixelsPerMM) => {
    setPixelsPerMM(calculatedPixelsPerMM);
    setIsCalibrated(true);
    if (userType === 'participant') {
      const availableConditions = getAvailableConditions();
      setCurrentCondition(0);
      setIsMirrorMode(availableConditions[0].mirror);
      setIsDecoupledMode(availableConditions[0].decoupled);
    }
    setMessage(userType === 'participant' ? 'Task started. Move the cursor to the green circle to begin.' : 'Researcher mode activated. All controls are available.');
  };

  const startCalibration = () => {
    setShowCalibration(true);
  };

  const handleHit = () => {
    calculateKinematicMetrics();
    const hitTime = Date.now() - startTimeRef.current;
    setStats(prevStats => ({
      hits: prevStats.hits + 1,
      misses: prevStats.misses,
      avgTime: Math.round((prevStats.avgTime * prevStats.hits + hitTime) / (prevStats.hits + 1))
    }));
    setPaths(prevPaths => [...prevPaths, currentPath]);
    setTarget(null);
    setGameState('waiting');
    setCursorPos(START_POSITION);
    setShowStartPosition(true);
  
    if (userType === 'participant') {
      setTrialsCompleted(prev => {
        const newTrialsCompleted = prev + 1;
        if (newTrialsCompleted === TRIALS_PER_CONDITION) {
          const availableConditions = getAvailableConditions();
          if (currentCondition < availableConditions.length - 1) {
            const nextCondition = currentCondition + 1;
            setCurrentCondition(nextCondition);
            setTrialsCompleted(0);
            setIsMirrorMode(availableConditions[nextCondition].mirror);
            setIsDecoupledMode(availableConditions[nextCondition].decoupled);
          } else {
            setIsTaskComplete(true);
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        }
        return newTrialsCompleted;
      });
    }

    setMessage(userType === 'participant' ? `Trial complete. ${TRIALS_PER_CONDITION - trialsCompleted - 1} trials left in this condition.` : 'Target hit! Move back to the center to continue.');
  };

  const handleMouseLeave = () => {
    if (gameState === 'active') {
      setStats(prevStats => ({
        ...prevStats,
        misses: prevStats.misses + 1
      }));
      setPaths(prevPaths => [...prevPaths, currentPath]);
      setTarget(null);
      setGameState('waiting');
      setCursorPos(START_POSITION);
      setMessage('Mouse left the game area. Move back to the center to continue.');
    }
  };

  const renderPaths = () => {
    return paths.map((path, index) => (
      <svg key={index} className="absolute top-0 left-0" width={GAME_SIZE} height={GAME_SIZE}>
        <path
          d={`M ${path[0].x + CURSOR_SIZE / 2} ${path[0].y + CURSOR_SIZE / 2} ${path.map(p => `L ${p.x + CURSOR_SIZE / 2} ${p.y + CURSOR_SIZE / 2}`).join(' ')}`}
          fill="none"
          stroke="rgba(0, 0, 255, 0.5)"
          strokeWidth="2"
        />
      </svg>
    ));
  };

  const renderGameArea = (isTopBox = true) => (
    <div
      className={`relative bg-white border-2 border-gray-300 ${isTopBox ? 'mb-4' : ''}`}
      style={{ width: GAME_SIZE, height: GAME_SIZE }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {showPaths && renderPaths()}
      {isTopBox && target && (
        <div
          className="absolute bg-red-500 rounded-full"
          style={{
            width: TARGET_SIZE,
            height: TARGET_SIZE,
            left: TARGET_POSITIONS[target].x,
            top: TARGET_POSITIONS[target].y,
          }}
        />
      )}
      {(!isDecoupledMode || isTopBox) && (
        <div
          className="absolute bg-blue-500 rounded-full"
          style={{
            width: CURSOR_SIZE,
            height: CURSOR_SIZE,
            left: cursorPos.x,
            top: cursorPos.y,
          }}
        />
      )}
      {isTopBox && showStartPosition && (
        <div
          className="absolute bg-green-500 rounded-full"
          style={{
            width: CURSOR_SIZE,
            height: CURSOR_SIZE,
            left: START_POSITION.x,
            top: START_POSITION.y,
          }}
        />
      )}
    </div>
  );

  const renderMetrics = () => (
    <div className="mt-4 text-sm">
      <h3 className="font-bold mb-2">Kinematic Metrics (Averages):</h3>
      <p>Reaction Time: {average(kinematicMetrics.reactionTime).toFixed(2)} ms</p>
      <p>Movement Time: {average(kinematicMetrics.movementTime).toFixed(2)} ms</p>
      <p>Ballistic Movement Time: {average(kinematicMetrics.ballisticMovementTime).toFixed(2)} ms</p>
      <p>Peak Velocity: {average(kinematicMetrics.peakVelocity).toFixed(2)} px/s</p>
      <p>Time to Peak Velocity: {average(kinematicMetrics.timeTopeakVelocity).toFixed(2)} ms</p>
      <p>Full Path Length: {average(kinematicMetrics.fullPathLength).toFixed(2)} px</p>
      <p>Ballistic Path Length: {average(kinematicMetrics.ballisticPathLength).toFixed(2)} px</p>
      <p>Directness Ratio: {average(kinematicMetrics.directnessRatio).toFixed(2)}</p>
      <p>Movement Variability: {average(kinematicMetrics.movementVariability).toFixed(2)} px</p>
      <p>Endpoint Error: {average(kinematicMetrics.endpointError).toFixed(2)} px</p>
      <p>Movement Units: {average(kinematicMetrics.movementUnits).toFixed(2)}</p>
      <p>Corrective Movements: {average(kinematicMetrics.correctiveMovements).toFixed(2)}</p>
      <p>Direction Reversals: {average(kinematicMetrics.directionReversals).toFixed(2)}</p>
      <p>Percentage Direction Reversals: {average(kinematicMetrics.percentageDirectionReversals).toFixed(2)}%</p>
      <p>Absolute Error: {average(kinematicMetrics.absoluteError).toFixed(2)} px</p>
      <p>Variable Error: {average(kinematicMetrics.variableError).toFixed(2)} px</p>
      <p>Current Mode: {isMirrorMode ? 'Mirrored' : 'Direct'}</p>
      <p>Movement Types: {kinematicMetrics.movementType.join(', ')}</p>
    </div>
  );

  const average = (arr) => arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;

  const exportData = () => {
    const mainCsvContent = [
      ['Participant ID', participantId],
      ['Input Device', inputDevice],
      ['Trial', 'Reaction Time (ms)', 'Movement Time (ms)', 'Ballistic Movement Time (ms)', 
       'Peak Velocity (px/s)', 'Time to Peak Velocity (ms)', 'Full Path Length (px)', 
       'Ballistic Path Length (px)', 'Directness Ratio', 'Movement Variability (px)', 
       'Endpoint Error (px)', 'Movement Units', 'Corrective Movements', 'Direction Reversals', 
       'Percentage Direction Reversals (%)', 'Absolute Error (px)', 'Variable Error (px)',
       'Movement Type'],
      ...kinematicMetrics.reactionTime.map((_, index) => [
        index + 1,
        kinematicMetrics.reactionTime[index],
        kinematicMetrics.movementTime[index],
        kinematicMetrics.ballisticMovementTime[index],
        kinematicMetrics.peakVelocity[index],
        kinematicMetrics.timeTopeakVelocity[index],
        kinematicMetrics.fullPathLength[index],
        kinematicMetrics.ballisticPathLength[index],
        kinematicMetrics.directnessRatio[index],
        kinematicMetrics.movementVariability[index],
        kinematicMetrics.endpointError[index],
        kinematicMetrics.movementUnits[index],
        kinematicMetrics.correctiveMovements[index],
        kinematicMetrics.directionReversals[index],
        kinematicMetrics.percentageDirectionReversals[index],
        kinematicMetrics.absoluteError[index],
        kinematicMetrics.variableError[index],
        kinematicMetrics.movementType[index]
      ])
    ].map(row => row.join(',')).join('\n');

    const rawPathCsvContent = paths.map((path, trialIndex) => {
      const trialData = [
        `Trial ${trialIndex + 1}`,
        'Time (ms)', 'X Position (px)', 'Y Position (px)'
      ];
      path.forEach(point => {
        trialData.push(`${point.time},${point.x},${point.y}`);
      });
      return trialData.join('\n');
    }).join('\n\n');

    const fullCsvContent = `${mainCsvContent}\n\nRaw Path Data:\n${rawPathCsvContent}`;

    const blob = new Blob([fullCsvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `cognitive_motor_task_data_${participantId}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!isFormSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Participant Information</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="participantId">Participant ID</Label>
                <Input
                  id="participantId"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inputDevice">Input Device</Label>
                <Select onValueChange={setInputDevice} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select input device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="touchscreen">Touchscreen</SelectItem>
                    <SelectItem value="mouse">Mouse</SelectItem>
                    <SelectItem value="trackpad">Trackpad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userType">User Type</Label>
                <Select onValueChange={setUserType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">Participant</SelectItem>
                    <SelectItem value="researcher">Researcher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Submit</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isFormSubmitted && !isCalibrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Calibration</CardTitle>
          </CardHeader>
          <CardContent>
            <Calibration 
              onCalibrationComplete={handleCalibrationComplete} 
              creditCardLength={CREDIT_CARD_LENGTH_MM}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTaskComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Task Complete!</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Thank you for participating in the study.</p>
            <Button onClick={exportData} className="mt-4">Download Results</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Cognitive Motor Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[100px] mb-4">
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="mb-4">
            {isDecoupledMode ? (
              <>
                {renderGameArea(true)}
                <div ref={gameRef}>{renderGameArea(false)}</div>
              </>
            ) : (
              <div ref={gameRef}>{renderGameArea()}</div>
            )}
            </div>
            {userType === 'participant' ? (
            <div className="mt-4">
              <p>Current Condition: {getAvailableConditions()[currentCondition]?.name}</p>
              <p>Trials Completed: {trialsCompleted} / {TRIALS_PER_CONDITION}</p>
              <p>Available Conditions: {conditions.map(c => c.name).join(', ')}</p>
            </div>
          ) : (
            <>
              <div className="mt-4">
                <p>Participant ID: {participantId}</p>
                <p>Input Device: {inputDevice}</p>
                <p>Hits: {stats.hits}</p>
                <p>Misses: {stats.misses}</p>
                <p>Average Time: {stats.avgTime} ms</p>
              </div>
              {renderMetrics()}
              <div className="flex flex-wrap justify-between mt-4 gap-2">
                <Button onClick={() => {
                  setIsMirrorMode(!isMirrorMode);
                  setMessage(isMirrorMode ? 'Mirror mode disabled.' : 'Mirror mode enabled. Cursor movement is now reversed.');
                }}>
                  {isMirrorMode ? 'Disable' : 'Enable'} Mirror Mode
                </Button>
                <Button onClick={() => setShowPaths(!showPaths)}>
                  {showPaths ? 'Hide' : 'Show'} Paths
                </Button>
                <Button onClick={() => {
                  setIsDecoupledMode(!isDecoupledMode);
                  setMessage(isDecoupledMode ? 'Coupled mode enabled.' : 'Decoupled mode enabled. Control cursor in bottom box, target in top box.');
                }}>
                  {isDecoupledMode ? 'Coupled' : 'Decoupled'} Mode
                </Button>
                <Button onClick={exportData}>Export Full Data</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}