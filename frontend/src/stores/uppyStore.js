import { defineStore } from 'pinia';

// Uppy expects a store compatible with @uppy/store-default:
// - getState(): returns state object
// - setState(patch): shallow-merges into state and notifies subscribers
// - subscribe(listener): returns unsubscribe function
//
// Pinia's $subscribe payload shape is not compatible with Uppy store listeners,
// so we implement Uppy-style subscriptions ourselves.
const listeners = new Set();

export const useUppyStore = defineStore({
  id: 'uppyStore',
  state: () => ({
    uppy: null,
    state: {},
  }),

  actions: {
    getState() {
      return this.state;
    },

    setState(patch) {
      const prevState = { ...(this.state || {}) };
      const nextState = { ...(this.state || {}), ...(patch || {}) };
      this.state = nextState;

      listeners.forEach((listener) => {
        try {
          listener(prevState, nextState, patch);
        } catch (_) {
          // Ignore subscriber errors to avoid breaking Uppy state updates.
        }
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
});
