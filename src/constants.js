// Game constants
export const GAME_SIZE = 350;
export const TARGET_SIZE = 30;
export const CURSOR_SIZE = 15;
export const CENTER_THRESHOLD = 10;
export const EDGE_BUFFER = 10;
export const START_POSITION = { 
  x: GAME_SIZE / 2 - CURSOR_SIZE / 2, 
  y: GAME_SIZE / 2 - CURSOR_SIZE / 2 
};

// Timing constants
export const CENTER_HOLD_TIME = 2000;  // 2 seconds for initial hold
export const TARGET_HOLD_TIME = 500;   // 500ms for target hold
export const DEFAULT_TRIALS = 20;

// Calibration constants
export const CREDIT_CARD_LENGTH_MM = 85.6;

// Target positions
export const TARGET_POSITIONS = {
  top: { x: GAME_SIZE / 2 - TARGET_SIZE / 2, y: EDGE_BUFFER },
  bottom: { x: GAME_SIZE / 2 - TARGET_SIZE / 2, y: GAME_SIZE - TARGET_SIZE - EDGE_BUFFER },
  left: { x: EDGE_BUFFER, y: GAME_SIZE / 2 - TARGET_SIZE / 2 },
  right: { x: GAME_SIZE - TARGET_SIZE - EDGE_BUFFER, y: GAME_SIZE / 2 - TARGET_SIZE / 2 },
};

export const getUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  
  const params = urlParams.get('conditions') ? urlParams : hashParams;
  
  const trials = parseInt(params.get('trials')) || DEFAULT_TRIALS;
  const conditionsStr = params.get('conditions') || 'regular,mirror,decoupled,decoupledMirror';
  const conditions = conditionsStr.toLowerCase().split(',').map(c => c.trim());
  
  console.log('Parsed URL params:', { trials, conditions });
  return { trials, conditions };
};