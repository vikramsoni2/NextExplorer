import UploadProgress from './UploadProgress.vue';
import { useUppyStore } from '@/stores/uppyStore';

function noop() {}

function seedUppyStore(state) {
  const store = useUppyStore();
  store.$reset();
  store.uppy = {
    resumeAll: noop,
    pauseAll: noop,
    cancelAll: noop,
  };
  store.setState(state);
}

function makeDemoState({
  now = Date.now(),
  totalProgress = 42,
  allComplete = false,
} = {}) {
  const files = {
    a: {
      id: 'a',
      name: 'Vacation.jpg',
      size: 2_340_000,
      extension: 'jpg',
      meta: { uploadTo: '/mnt/Files/Photos' },
      progress: {
        bytesTotal: 2_340_000,
        bytesUploaded: allComplete ? 2_340_000 : 1_220_000,
        percentage: allComplete ? 100 : 52,
        uploadComplete: allComplete,
        uploadStarted: now - 12_000,
      },
    },
    b: {
      id: 'b',
      name: 'Notes.pdf',
      size: 980_000,
      type: 'application/pdf',
      meta: { uploadTo: '/mnt/Files/Docs' },
      progress: {
        bytesTotal: 980_000,
        bytesUploaded: allComplete ? 980_000 : 530_000,
        percentage: allComplete ? 100 : 54,
        uploadComplete: allComplete,
        uploadStarted: now - 7_000,
      },
    },
    c: {
      id: 'c',
      name: 'dataset.csv',
      size: 0,
      extension: 'csv',
      meta: { uploadTo: '/mnt/Files/Data' },
      progress: {
        bytesTotal: 0,
        bytesUploaded: 0,
        percentage: 0,
        uploadComplete: false,
        uploadStarted: now - 3_000,
      },
    },
  };

  return {
    totalProgress,
    currentUploads: allComplete ? {} : { a: true, b: true, c: true },
    files,
  };
}

export default {
  title: 'Components/UploadProgress',
  component: UploadProgress,
  parameters: { layout: 'fullscreen' },
};

export const Default = {
  args: {
    initialPosition: { x: 16, y: 16 },
  },
  render: (args) => ({
    components: { UploadProgress },
    setup() {
      seedUppyStore(makeDemoState({ totalProgress: 42 }));
      return { args };
    },
    template: '<UploadProgress v-bind="args" />',
  }),
};

export const DetailsOpen = {
  args: {
    initialPosition: { x: 16, y: 16 },
    defaultDetailsOpen: true,
  },
  render: (args) => ({
    components: { UploadProgress },
    setup() {
      seedUppyStore(makeDemoState({ totalProgress: 58 }));
      return { args };
    },
    template: '<UploadProgress v-bind="args" />',
  }),
};

export const Paused = {
  args: {
    initialPosition: { x: 16, y: 16 },
    defaultPaused: true,
  },
  render: (args) => ({
    components: { UploadProgress },
    setup() {
      seedUppyStore(makeDemoState({ totalProgress: 73 }));
      return { args };
    },
    template: '<UploadProgress v-bind="args" />',
  }),
};

export const Completed = {
  args: {
    initialPosition: { x: 16, y: 16 },
    forceVisible: true,
  },
  render: (args) => ({
    components: { UploadProgress },
    setup() {
      seedUppyStore(makeDemoState({ totalProgress: 100, allComplete: true }));
      return { args };
    },
    template: '<UploadProgress v-bind="args" />',
  }),
};
