class UnitConverter {
  constructor(pixelsPerMM = 1) {
    this.pixelsPerMM = pixelsPerMM;
  }

  // Convert pixels to millimeters
  pxToMm(pixels) {
    return pixels / this.pixelsPerMM;
  }

  // Convert millimeters to pixels
  mmToPx(mm) {
    return mm * this.pixelsPerMM;
  }

  // Convert pixel velocity to mm/s
  pxPerSecToMmPerSec(pxPerSec) {
    return pxPerSec / this.pixelsPerMM;
  }

  // Convert mm/s to px/s
  mmPerSecToPxPerSec(mmPerSec) {
    return mmPerSec * this.pixelsPerMM;
  }

  // Convert px/s² to mm/s²
  pxPerSecSqToMmPerSecSq(pxPerSecSq) {
    return pxPerSecSq / this.pixelsPerMM;
  }

  // Convert mm/s² to px/s²
  mmPerSecSqToPxPerSecSq(mmPerSecSq) {
    return mmPerSecSq * this.pixelsPerMM;
  }

  // Convert point coordinates from pixels to mm
  convertPointToMm(point) {
    return {
      x: this.pxToMm(point.x),
      y: this.pxToMm(point.y),
      time: point.time,
      timestamp: point.timestamp
    };
  }

  // Calculate length in mm between two points in pixels
  getDistanceMm(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return this.pxToMm(Math.sqrt(dx * dx + dy * dy));
  }
}

export default UnitConverter;