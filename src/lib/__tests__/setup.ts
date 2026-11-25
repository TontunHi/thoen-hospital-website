import '@testing-library/jest-dom/vitest'

// Prevent jsdom "Not implemented: HTMLCanvasElement's getContext()" console errors
// in Canvas/WebGL component tests; individual tests override this stub when needed.
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  })
}

