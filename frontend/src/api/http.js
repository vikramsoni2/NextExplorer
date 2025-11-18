import { useNotificationsStore } from '@/stores/notifications';

const DEFAULT_API_BASE = '/';
const apiBase = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');

const buildUrl = (endpoint) => `${apiBase}${endpoint}`;

const encodePath = (relativePath = '') => {
  if (!relativePath) return '';
  return relativePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
};

const normalizePath = (relativePath = '') => {
  if (!relativePath) {
    return '';
  }
  // Remove leading and trailing slashes
  return relativePath.replace(/^\/+|\/+$/g, '');
};


const requestRaw = async (endpoint, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (method !== 'GET' && method !== 'HEAD' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(buildUrl(endpoint), {
      credentials: options.credentials || 'include', // All requests rely on cookies
      ...options,
      method,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorDetails = null;

      try {
        // Try to parse backend error response
        const errorData = await response.json();

        // Handle new standardized error format
        if (errorData?.error) {
          if (typeof errorData.error === 'object') {
            // New format: { success: false, error: { message, statusCode, requestId, timestamp } }
            errorDetails = errorData.error;
            errorMessage = errorDetails.message || errorMessage;

            // Create notification for the error
            const notificationsStore = useNotificationsStore();
            notificationsStore.addNotification({
              type: 'error',
              heading: errorMessage,
              body: errorDetails.details ? JSON.stringify(errorDetails.details) : '',
              requestId: errorDetails.requestId,
              statusCode: errorDetails.statusCode || response.status,
            });
          } else {
            // Old format: { error: "string" }
            errorMessage = errorData.error;

            // Create notification for old format
            const notificationsStore = useNotificationsStore();
            notificationsStore.addNotification({
              type: 'error',
              heading: errorMessage,
              statusCode: response.status,
            });
          }
        }
      } catch (parseError) {
        // Ignore JSON parsing errors, create notification with basic info
        const notificationsStore = useNotificationsStore();
        notificationsStore.addNotification({
          type: 'error',
          heading: errorMessage,
          statusCode: response.status,
        });
      }

      throw new Error(errorMessage);
    }

    return response;
  } catch (error) {
    // Handle network errors (fetch failures)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const notificationsStore = useNotificationsStore();
      notificationsStore.addNotification({
        type: 'error',
        heading: 'Network Error',
        body: 'Failed to connect to server. Please check your internet connection.',
      });
    }

    // Re-throw the error so calling code can handle it
    throw error;
  }
};


const requestJson = async (endpoint, options = {}) => {
  const response = await requestRaw(endpoint, options);
  if (response.status === 204) {
    return null;
  }
  return response.json();
};

export {
  apiBase,
  buildUrl,
  encodePath,
  normalizePath,
  requestJson,
  requestRaw
}