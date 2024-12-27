import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const Calibration = ({ onCalibrationComplete, creditCardLength }) => {
  const [calibrationValue, setCalibrationValue] = useState(300);

  const handleCalibrationComplete = () => {
    const calculatedPixelsPerMM = calibrationValue / creditCardLength;
    onCalibrationComplete(calculatedPixelsPerMM);
  };

  return (
    <div className="mt-4 p-4 border rounded-md">
      <h3 className="text-lg font-semibold mb-2">DPI Calibration</h3>
      <p className="mb-4">Adjust the line below to match the length of a credit card ({creditCardLength}mm).</p>
      <div className="flex flex-col items-center space-y-4">
        <div
          className="bg-black"
          style={{
            width: `${calibrationValue}px`,
            height: '2px',
          }}
        />
        <Slider
          min={100}
          max={500}
          step={1}
          value={[calibrationValue]}
          onValueChange={(value) => setCalibrationValue(value[0])}
        />
        <Button onClick={handleCalibrationComplete}>Complete Calibration</Button>
      </div>
    </div>
  );
};

export default Calibration;