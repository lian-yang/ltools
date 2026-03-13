import { clampSliderPosition, initialDragState, reduceDragState } from './compareSlider';

const rectLeft = 10;
const rectWidth = 100;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(clampSliderPosition(10, rectLeft, rectWidth) === 0, 'expected clamp at left edge');
assert(clampSliderPosition(110, rectLeft, rectWidth) === 100, 'expected clamp at right edge');
assert(clampSliderPosition(60, rectLeft, rectWidth) === 50, 'expected mid clamp');

let state = reduceDragState(initialDragState, {
  type: 'pointerMove',
  clientX: 80,
  rectLeft,
  rectWidth,
});
assert(state.position === initialDragState.position, 'pointerMove without drag should not change position');
assert(state.isDragging === false, 'pointerMove without drag should not start dragging');

state = reduceDragState(initialDragState, {
  type: 'pointerDown',
  clientX: 80,
  rectLeft,
  rectWidth,
});
assert(state.isDragging === true, 'pointerDown should start dragging');
assert(Math.round(state.position) === 70, 'pointerDown should set initial position');

state = reduceDragState(state, {
  type: 'pointerMove',
  clientX: 90,
  rectLeft,
  rectWidth,
});
assert(Math.round(state.position) === 80, 'pointerMove should update position while dragging');

state = reduceDragState(state, { type: 'pointerUp' });
assert(state.isDragging === false, 'pointerUp should stop dragging');

console.log('compareSlider tests passed');
