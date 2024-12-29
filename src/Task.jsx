import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import confetti from 'canvas-confetti';

import ParticipantForm from './ParticipantForm';
import Calibration from './Calibration';
import GameArea from './GameArea';
import UnitConverter from './UnitConverter';
import { exportData } from './utils';


import {
  CREDIT_CARD_LENGTH_MM,
  DEFAULT_TRIALS,
  getUrlParams
} from './constants';

export default function CognitiveMotorTask() {
  // Core state
  const [participantId, setParticipantId] = useState('');
  const [inputDevice, setInputDevice] = useState('');
  const [userType, setUserType] = useState('');
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [unitConverter, setUnitConverter] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Trial tracking
  const [trialsCompleted, setTrialsCompleted] = useState(0);
  const [isTaskComplete, setIsTaskComplete] = useState(false);
  const [currentCondition, setCurrentCondition] = useState(0);
  const [isMirrorMode, setIsMirrorMode] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);

  // Get URL parameters
  const [urlParams] = useState(getUrlParams());
  const TRIALS_PER_CONDITION = urlParams.trials || DEFAULT_TRIALS;

  // Parse conditions from URL
  const conditions = urlParams.conditions.map(condition => {
    switch(condition.toLowerCase()) {
      case 'regular':
        return { name: 'Regular', mirror: false };
      case 'mirror':
        return { name: 'Mirror', mirror: true };
      default:
        console.log('Unknown condition:', condition);
        return null;
    }
  }).filter(Boolean);

  if (conditions.length === 0) {
    conditions.push({ name: 'Regular', mirror: false });
  }

  const handleFormSubmit = (formData) => {
    if (formData.participantId.trim() === '') {
      setError('Please enter a valid Participant ID.');
      return;
    }
    
    setParticipantId(formData.participantId);
    setInputDevice(formData.inputDevice);
    setUserType(formData.userType);
    setIsFormSubmitted(true);
    
    if (formData.userType === 'participant') {
      setCurrentCondition(0);
      setIsMirrorMode(conditions[0].mirror);
    }
  };

  const handleCalibrationComplete = (calculatedPixelsPerMM) => {
    setUnitConverter(new UnitConverter(calculatedPixelsPerMM));
    setIsCalibrated(true);
    setMessage('Move to the green circle to begin.');
  };

  // Data state
  const [trialData, setTrialData] = useState([]);

  const handleTrialComplete = (newTrialData) => {
    setTrialData(prev => [...prev, newTrialData]);

    if (userType === 'participant') {
      setTrialsCompleted(prev => {
        const newTrialsCompleted = prev + 1;
        if (newTrialsCompleted === TRIALS_PER_CONDITION) {
          if (currentCondition < conditions.length - 1) {
            const nextCondition = currentCondition + 1;
            setCurrentCondition(nextCondition);
            setTrialsCompleted(0);
            setIsMirrorMode(conditions[nextCondition].mirror);
            setMessage(`Starting ${conditions[nextCondition].name} condition.`);
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
  };

  const handleExport = () => {
    exportData(trialData, unitConverter, participantId);
  };

  // Render states
  if (!isFormSubmitted) {
    return (
      <ParticipantForm 
        onSubmit={handleFormSubmit}
        error={error}
      />
    );
  }

  if (!isCalibrated) {
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
          <CardContent className="space-y-4">
            <p>Thank you for participating in the study.</p>
            <div className="flex justify-center">
              <Button onClick={handleExport}>
                Download Data
              </Button>
            </div>
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
          
          <GameArea
            onTrialComplete={handleTrialComplete}
            isMirrorMode={isMirrorMode}
            unitConverter={unitConverter}
            isResearcherMode={userType === 'researcher'}
            showPaths={showPaths}
            paths={paths}
            currentPath={currentPath}
            onPathUpdate={setCurrentPath}
            participantId={participantId}   
            inputDevice={inputDevice}       
          />

          {userType === 'researcher' ? (
            <>
              <div className="mt-4">
                <p>Participant ID: {participantId}</p>
                <p>Input Device: {inputDevice}</p>
                <div className="flex flex-wrap justify-between mt-4 gap-2">
                  <Button onClick={() => setIsMirrorMode(!isMirrorMode)}>
                    {isMirrorMode ? 'Disable' : 'Enable'} Mirror Mode
                  </Button>
                  <Button onClick={() => setShowPaths(!showPaths)}>
                    {showPaths ? 'Hide' : 'Show'} Paths
                  </Button>
                  <Button onClick={handleExport}>Export Data</Button>
                </div>
                
                {/* Data Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left">Trial</th>
                        <th className="p-2 text-left">Time (ms)</th>
                        <th className="p-2 text-left">Target</th>
                        <th className="p-2 text-left">Path Length (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialData.map((trial, index) => {
                        const pathLength = trial.path.reduce((length, point, i) => {
                          if (i === 0) return 0;
                          const dx = point.x - trial.path[i-1].x;
                          const dy = point.y - trial.path[i-1].y;
                          const segmentLength = Math.sqrt(dx * dx + dy * dy);
                          return length + unitConverter.pxToMm(segmentLength);
                        }, 0);

                        return (
                          <tr key={index} className="border-b">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">{trial.movementTime.toFixed(2)}</td>
                            <td className="p-2">{trial.targetPosition}</td>
                            <td className="p-2">{pathLength.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Raw data display */}
                <div className="mt-4">
                  <h3 className="font-bold mb-2">Latest Trial Raw Data:</h3>
                  <div className="bg-gray-100 p-2 rounded">
                    <pre className="whitespace-pre-wrap text-xs">
                      {trialData.length > 0 && JSON.stringify(trialData[trialData.length - 1], null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <p>Current Condition: {conditions[currentCondition]?.name}</p>
              <p>Trials Completed: {trialsCompleted} / {TRIALS_PER_CONDITION}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}