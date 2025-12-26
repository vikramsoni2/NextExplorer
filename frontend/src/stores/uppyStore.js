import { defineStore } from 'pinia';

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
      const prevState = this.state;
      const nextState = { ...prevState, ...patch };

      this.state = nextState;

      this.$patch({
        state: nextState,
      });
    },
    subscribe(listener) {
      const unsubscribe = this.$subscribe(
        (mutation, state) => {
          const patch = mutation.payload;
          listener(mutation.oldState, state, patch);
        },
        { immediate: true },
      );

      return unsubscribe;
    },
  },
});
