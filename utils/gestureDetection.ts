
import { Point } from '../types';

/**
 * Calculates Euclidean distance between two 3D points
 */
export const calculateDistance = (p1: any, p2: any): number => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + 
    Math.pow(p1.y - p2.y, 2) + 
    Math.pow(p1.z - p2.z, 2)
  );
};

/**
 * Detects if the hand is in a 'pinch' gesture (thumb and index finger close together)
 */
export const isPinching = (landmarks: any[]): boolean => {
  if (!landmarks || landmarks.length < 21) return false;
  
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  const distance = calculateDistance(thumbTip, indexTip);
  // Threshold calibrated for MediaPipe normalized coordinates
  return distance < 0.05;
};

/**
 * Detects if the hand is an 'open palm' (all fingers extended)
 */
export const isOpenPalm = (landmarks: any[]): boolean => {
  if (!landmarks || landmarks.length < 21) return false;
  
  const wrist = landmarks[0];
  const fingerTips = [8, 12, 16, 20]; // index, middle, ring, pinky
  const fingerMcp = [5, 9, 13, 17];
  
  // An open palm usually means the distance from wrist to tip is significantly 
  // larger than distance from wrist to MCP for most fingers
  let extendedFingers = 0;
  for (let i = 0; i < fingerTips.length; i++) {
    const tipDist = calculateDistance(wrist, landmarks[fingerTips[i]]);
    const mcpDist = calculateDistance(wrist, landmarks[fingerMcp[i]]);
    if (tipDist > mcpDist * 1.2) {
      extendedFingers++;
    }
  }
  
  return extendedFingers >= 3;
};

/**
 * Maps normalized MediaPipe coordinates to screen coordinates with smoothing
 */
export const mapHandToScreen = (
  landmark: any, 
  canvasWidth: number, 
  canvasHeight: number,
  prevPos: Point | null,
  smoothing: number = 0.2
): Point => {
  // Flip X for mirror effect
  const targetX = (1 - landmark.x) * canvasWidth;
  const targetY = landmark.y * canvasHeight;
  
  if (!prevPos) return { x: targetX, y: targetY };
  
  return {
    x: prevPos.x + (targetX - prevPos.x) * smoothing,
    y: prevPos.y + (targetY - prevPos.y) * smoothing
  };
};
