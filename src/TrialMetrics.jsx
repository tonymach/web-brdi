import React from 'react';
import { Button } from "@/components/ui/button";

const TrialMetrics = ({ metrics, currentTrial, setCurrentTrial }) => {
  const totalTrials = metrics.reactionTime.length;

  const handlePrevTrial = () => {
    setCurrentTrial(prev => Math.max(0, prev - 1));
  };

  const handleNextTrial = () => {
    setCurrentTrial(prev => Math.min(totalTrials - 1, prev + 1));
  };

  return (
    <div className="mt-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Trial {currentTrial + 1} of {totalTrials} Metrics:</h3>
        <div className="flex gap-2">
          <Button 
            onClick={handlePrevTrial} 
            disabled={currentTrial === 0}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
          <Button 
            onClick={handleNextTrial} 
            disabled={currentTrial === totalTrials - 1}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <p>Reaction Time: {metrics.reactionTime[currentTrial]?.toFixed(2)} ms</p>
        <p>Movement Time: {metrics.movementTime[currentTrial]?.toFixed(2)} ms</p>
        <p>Ballistic Time: {metrics.ballisticMovementTime[currentTrial]?.toFixed(2)} ms</p>
        <p>Peak Velocity: {metrics.peakVelocity[currentTrial]?.toFixed(2)} mm/s</p>
        <p>Time to Peak: {metrics.timeTopeakVelocity[currentTrial]?.toFixed(2)} ms</p>
        <p>Path Length: {metrics.fullPathLength[currentTrial]?.toFixed(2)} mm</p>
        <p>Ballistic Length: {metrics.ballisticPathLength[currentTrial]?.toFixed(2)} mm</p>
        <p>Directness: {metrics.directnessRatio[currentTrial]?.toFixed(2)}</p>
        <p>Variability: {metrics.movementVariability[currentTrial]?.toFixed(2)} mm</p>
        <p>Endpoint Error: {metrics.endpointError[currentTrial]?.toFixed(2)} mm</p>
        <p>Movement Units: {metrics.movementUnits[currentTrial]?.toFixed(2)}</p>
        <p>Corrections: {metrics.correctiveMovements[currentTrial]?.toFixed(2)}</p>
        <p>Reversals: {metrics.directionReversals[currentTrial]?.toFixed(2)}</p>
        <p>Reversal %: {metrics.percentageDirectionReversals[currentTrial]?.toFixed(2)}%</p>
        <p>Absolute Error: {metrics.absoluteError[currentTrial]?.toFixed(2)} mm</p>
        <p>Variable Error: {metrics.variableError[currentTrial]?.toFixed(2)} mm</p>
        <p>Mode: {metrics.movementType[currentTrial]}</p>
      </div>
    </div>
  );
};

export default TrialMetrics;