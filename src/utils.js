export const exportData = (data, unitConverter, participantId) => {
    const mainCsvContent = [
      ['Participant ID', participantId],
      [
        'Trial',
        'Movement Time (ms)',
        'Reaction Time (ms)',
        'Target Position',
        'Path Length (mm)',
        'Average Velocity (mm/s)',
        'Peak Velocity (mm/s)',
        'Time to Peak Velocity (ms)',
        'Average Acceleration (mm/s²)',
        'Number of Submovements',
        'Straightness Ratio',
        'Time in Target (ms)'
      ]
    ];
  
    // Add trial data with enhanced metrics
    data.forEach((trial, index) => {
      const pathLength = calculatePathLength(trial.path, unitConverter);
      const velocityMetrics = calculateVelocityMetrics(trial.path, unitConverter);
      const submovements = countSubmovements(trial.path);
      const straightnessRatio = calculateStraightnessRatio(trial.path, unitConverter);
      const timeInTarget = calculateTotalTimeInTarget(trial.path);
  
      mainCsvContent.push([
        index + 1,
        trial.movementTime,
        trial.reactionTime,
        trial.targetPosition,
        pathLength.toFixed(2),
        velocityMetrics.averageVelocity.toFixed(2),
        velocityMetrics.peakVelocity.toFixed(2),
        velocityMetrics.timeToPeakVelocity.toFixed(2),
        velocityMetrics.averageAcceleration.toFixed(2),
        submovements,
        straightnessRatio.toFixed(3),
        timeInTarget.toFixed(2)
      ]);
    });
  
    // Add detailed path data
    const rawPathContent = data.map((trial, trialIndex) => {
      const header = [`Trial ${trialIndex + 1} Path Data`];
      const pathData = trial.path.map(point => {
        const mmX = unitConverter.pxToMm(point.x);
        const mmY = unitConverter.pxToMm(point.y);
        return [
          point.time.toFixed(2),
          mmX.toFixed(2),
          mmY.toFixed(2),
          point.velocity?.toFixed(2) || '',
          point.acceleration?.toFixed(2) || '',
          point.distanceToTarget?.toFixed(2) || '',
          point.isInTarget ? '1' : '0'
        ].join(',');
      });
      return [
        header,
        'Time (ms),X (mm),Y (mm),Velocity (mm/s),Acceleration (mm/s²),Distance to Target (mm),In Target',
        ...pathData
      ].join('\n');
    }).join('\n\n');
  
    const fullContent = mainCsvContent.map(row => row.join(',')).join('\n') + 
      '\n\n' + rawPathContent;
  
    // Create and trigger download
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `motor_task_${participantId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Helper functions for calculating metrics
  const calculateVelocityMetrics = (path, unitConverter) => {
    let peakVelocity = 0;
    let timeToPeakVelocity = 0;
    let totalVelocity = 0;
    let totalAcceleration = 0;
    let validSamples = 0;
  
    path.forEach((point, i) => {
      if (point.velocity) {
        const velocityMMS = unitConverter.pxToMm(point.velocity * 1000); // Convert to mm/s
        totalVelocity += velocityMMS;
        
        if (velocityMMS > peakVelocity) {
          peakVelocity = velocityMMS;
          timeToPeakVelocity = point.time;
        }
        
        if (point.acceleration) {
          totalAcceleration += unitConverter.pxToMm(point.acceleration * 1000000); // Convert to mm/s²
        }
        
        validSamples++;
      }
    });
  
    return {
      averageVelocity: totalVelocity / validSamples,
      peakVelocity,
      timeToPeakVelocity,
      averageAcceleration: totalAcceleration / validSamples
    };
  };
  
  const countSubmovements = (path) => {
    let submovements = 0;
    let lastVelocityTrend = 0; // -1 decreasing, 1 increasing
    
    path.forEach((point, i) => {
      if (i > 0 && point.velocity) {
        const velocityChange = point.velocity - path[i-1].velocity;
        const currentTrend = Math.sign(velocityChange);
        
        // Count when velocity changes from increasing to decreasing
        if (lastVelocityTrend === 1 && currentTrend === -1) {
          submovements++;
        }
        
        lastVelocityTrend = currentTrend;
      }
    });
    
    return submovements;
  };
  
  const calculateStraightnessRatio = (path, unitConverter) => {
    if (path.length < 2) return 1;
    
    // Calculate actual path length
    const actualLength = calculatePathLength(path, unitConverter);
    
    // Calculate direct distance between start and end points
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const directLength = unitConverter.pxToMm(Math.sqrt(dx * dx + dy * dy));
    
    return directLength / actualLength;
  };
  
  const calculateTotalTimeInTarget = (path) => {
    return path.reduce((total, point) => {
      return total + (point.isInTarget ? point.timeInTarget || 0 : 0);
    }, 0);
  };
  
  const calculatePathLength = (path, unitConverter) => {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x;
      const dy = path[i].y - path[i-1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      length += unitConverter.pxToMm(segmentLength);
    }
    return length;
  };

  