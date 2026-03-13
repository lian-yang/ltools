export type DragState = {
  isDragging: boolean;
  position: number;
};

export type DragAction =
  | {
      type: 'pointerDown' | 'pointerMove';
      clientX: number;
      rectLeft: number;
      rectWidth: number;
    }
  | { type: 'pointerUp' | 'pointerCancel' };

export const initialDragState: DragState = {
  isDragging: false,
  position: 50,
};

export function clampSliderPosition(clientX: number, rectLeft: number, rectWidth: number): number {
  if (rectWidth <= 0) {
    return 0;
  }
  const percentage = ((clientX - rectLeft) / rectWidth) * 100;
  return Math.max(0, Math.min(100, percentage));
}

export function reduceDragState(state: DragState, action: DragAction): DragState {
  switch (action.type) {
    case 'pointerDown': {
      if (action.rectWidth <= 0) {
        return { ...state, isDragging: true };
      }
      return {
        isDragging: true,
        position: clampSliderPosition(action.clientX, action.rectLeft, action.rectWidth),
      };
    }
    case 'pointerMove': {
      if (!state.isDragging || action.rectWidth <= 0) {
        return state;
      }
      return {
        ...state,
        position: clampSliderPosition(action.clientX, action.rectLeft, action.rectWidth),
      };
    }
    case 'pointerUp':
    case 'pointerCancel': {
      if (!state.isDragging) {
        return state;
      }
      return { ...state, isDragging: false };
    }
    default:
      return state;
  }
}
