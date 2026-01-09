// API Configuration
// Automatically uses correct port based on environment

const isDev = import.meta.env.MODE === 'development';
const API_PORT = isDev ? 3002 : 3001;

export const API_BASE_URL = `http://localhost:${API_PORT}`;

// Helper function to build API endpoints
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Log current API configuration in development
if (isDev) {
  console.log(`🔧 Dev Mode: API calls going to ${API_BASE_URL}`);
}
