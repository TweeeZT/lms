interface Window {
  __scratchEvents: {
    flag: Array<() => Promise<void>>;
    keys: {
      [key: string]: Array<() => Promise<void>>;
    };
  };
  _blocklyMouseX?: number;
  _blocklyMouseY?: number;
}