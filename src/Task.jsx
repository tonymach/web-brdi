import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import confetti from 'canvas-confetti';

const GAME_SIZE = 350;
const TARGET_SIZE = 30;
const CURSOR_SIZE = 15;
const CENTER_THRESHOLD = 10;
const EDGE_BUFFER = 10; // New constant for buffer from edges
const START_POSITION = { x: GAME_SIZE / 2 - CURSOR_SIZE / 2, y: GAME_SIZE / 2 - CURSOR_SIZE / 2 };
const COLLECTION_INTERVAL = 10;
const TARGET_DELAY = 1000;
const TRIALS_PER_CONDITION = 5;

const TARGET_POSITIONS = {
  top: { x: GAME_SIZE / 2 - TARGET_SIZE / 2, y: EDGE_BUFFER },
  bottom: { x: GAME_SIZE / 2 - TARGET_SIZE / 2, y: GAME_SIZE - TARGET_SIZE - EDGE_BUFFER },
  left: { x: EDGE_BUFFER, y: GAME_SIZE / 2 - TARGET_SIZE / 2 },
  right: { x: GAME_SIZE - TARGET_SIZE - EDGE_BUFFER, y: GAME_SIZE / 2 - TARGET_SIZE / 2 },
};

SAMPLING_RATE = 100  # Hz (10ms interval)
VELOCITY_THRESHOLD = 50  # pixels/second for movement initiation
TARGET_SIZE = 30  # pixels

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
    pathLength: [], directnessRatio: [], movementVariability: [], endpointError: [], movementUnits: []
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

  const conditions = [
    { name: 'Regular', mirror: false, decoupled: false },
    { name: 'Mirror', mirror: true, decoupled: false },
    { name: 'Decoupled', mirror: false, decoupled: true },
    { name: 'Decoupled Mirror', mirror: true, decoupled: true }
  ];

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
    const dt = COLLECTION_INTERVAL / 1000; // Time step in seconds
    const dx = newPos.x - lastPos.current.x;
    const dy = newPos.y - lastPos.current.y;
    const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
    velocities.current.push(velocity);

    if (velocities.current.length > 1) {
      const acceleration = (velocity - velocities.current[velocities.current.length - 2]) / dt;
      accelerations.current.push(acceleration);
    }

    lastPos.current = newPos;
  };

  const calculateKinematicMetrics = () => {
    const reactionTime = currentPath[0]?.time || 0;
    const movementTime = currentPath[currentPath.length - 1]?.time - reactionTime;
    const peakVelocity = Math.max(...velocities.current);
    const timeTopeakVelocity = velocities.current.indexOf(peakVelocity) * COLLECTION_INTERVAL;
    
    let pathLength = 0;
    for (let i = 1; i < currentPath.length; i++) {
      const dx = currentPath[i].x - currentPath[i-1].x;
      const dy = currentPath[i].y - currentPath[i-1].y;
      pathLength += Math.sqrt(dx * dx + dy * dy);
    }

    const startToEndDistance = Math.sqrt(
      Math.pow(currentPath[currentPath.length - 1].x - currentPath[0].x, 2) +
      Math.pow(currentPath[currentPath.length - 1].y - currentPath[0].y, 2)
    );
    const directnessRatio = startToEndDistance / pathLength;

    const avgX = currentPath.reduce((sum, pos) => sum + pos.x, 0) / currentPath.length;
    const avgY = currentPath.reduce((sum, pos) => sum + pos.y, 0) / currentPath.length;
    const movementVariability = currentPath.reduce((sum, pos) => {
      return sum + Math.sqrt(Math.pow(pos.x - avgX, 2) + Math.pow(pos.y - avgY, 2));
    }, 0) / currentPath.length;

    const targetPos = TARGET_POSITIONS[target];
    const endpointError = Math.sqrt(
      Math.pow(currentPath[currentPath.length - 1].x - targetPos.x, 2) +
      Math.pow(currentPath[currentPath.length - 1].y - targetPos.y, 2)
    );

    let movementUnits = 1; // Count the initial acceleration
    for (let i = 1; i < accelerations.current.length; i++) {
      if (accelerations.current[i-1] < 0 && accelerations.current[i] > 0) {
        movementUnits++;
      }
    }

    setKinematicMetrics(prevMetrics => ({
      reactionTime: [...prevMetrics.reactionTime, reactionTime],
      movementTime: [...prevMetrics.movementTime, movementTime],
      peakVelocity: [...prevMetrics.peakVelocity, peakVelocity],
      timeTopeakVelocity: [...prevMetrics.timeTopeakVelocity, timeTopeakVelocity],
      pathLength: [...prevMetrics.pathLength, pathLength],
      directnessRatio: [...prevMetrics.directnessRatio, directnessRatio],
      movementVariability: [...prevMetrics.movementVariability, movementVariability],
      endpointError: [...prevMetrics.endpointError, endpointError],
      movementUnits: [...prevMetrics.movementUnits, movementUnits],
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

    if (userType === 'participant') {
      setTrialsCompleted(prev => {
        const newTrialsCompleted = prev + 1;
        if (newTrialsCompleted === TRIALS_PER_CONDITION) {
          if (currentCondition < conditions.length - 1) {
            setCurrentCondition(prev => prev + 1);
            setTrialsCompleted(0);
            setIsMirrorMode(conditions[currentCondition + 1].mirror);
            setIsDecoupledMode(conditions[currentCondition + 1].decoupled);
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
      {isTopBox && (
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
      <p>Peak Velocity: {average(kinematicMetrics.peakVelocity).toFixed(2)} px/s</p>
      <p>Time to Peak Velocity: {average(kinematicMetrics.timeTopeakVelocity).toFixed(2)} ms</p>
      <p>Path Length: {average(kinematicMetrics.pathLength).toFixed(2)} px</p>
      <p>Directness Ratio: {average(kinematicMetrics.directnessRatio).toFixed(2)}</p>
      <p>Movement Variability: {average(kinematicMetrics.movementVariability).toFixed(2)} px</p>
      <p>Endpoint Error: {average(kinematicMetrics.endpointError).toFixed(2)} px</p>
      <p>Movement Units: {average(kinematicMetrics.movementUnits).toFixed(2)}</p>
    </div>
  );

  const average = (arr) => arr.length ? arr.reduce((a, b) => a + b) /arr.length : 0;

  const exportData = () => {
    // Create the main data CSV content
    const mainCsvContent = [
      ['Participant ID', participantId],
      ['Input Device', inputDevice],
      ['Trial', 'Reaction Time (ms)', 'Movement Time (ms)', 'Peak Velocity (px/s)', 'Time to Peak Velocity (ms)', 'Path Length (px)', 'Directness Ratio', 'Movement Variability (px)', 'Endpoint Error (px)', 'Movement Units'],
      ...kinematicMetrics.reactionTime.map((_, index) => [
        index + 1,
        kinematicMetrics.reactionTime[index],
        kinematicMetrics.movementTime[index],
        kinematicMetrics.peakVelocity[index],
        kinematicMetrics.timeTopeakVelocity[index],
        kinematicMetrics.pathLength[index],
        kinematicMetrics.directnessRatio[index],
        kinematicMetrics.movementVariability[index],
        kinematicMetrics.endpointError[index],
        kinematicMetrics.movementUnits[index]
      ])
    ].map(row => row.join(',')).join('\n');

    // Create the raw path data CSV content
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

    // Combine both CSVs
    const fullCsvContent = `${mainCsvContent}\n\nRaw Path Data:\n${rawPathCsvContent}`;

    // Create and trigger download
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
              <Button type="submit" className="w-full">Start Task</Button>
            </form>
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
        <div className="h-[100px] mb-4"> {/* Fixed height container for messages */}
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="mb-4"> {/* Container for game area */}
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
              <p>Current Condition: {conditions[currentCondition].name}</p>
              <p>Trials Completed: {trialsCompleted} / {TRIALS_PER_CONDITION}</p>
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