/**
 * API Client Module
 * Handles API calls via server proxy (keeps API key secure)
 */

// Use server proxy instead of direct API calls
const CHAT_API_URL = '/api/chat';
const CHAT_STATUS_URL = '/api/chat/status';

// Cache API status
let apiConfigured = null;

/**
 * Check if API is configured
 */
async function checkAPIStatus() {
  if (apiConfigured !== null) return apiConfigured;
  
  try {
    const response = await fetch(CHAT_STATUS_URL);
    const data = await response.json();
    apiConfigured = data.configured;
    return apiConfigured;
  } catch {
    apiConfigured = false;
    return false;
  }
}

/**
 * Call Groq API via server proxy
 */
export async function callGroqAPI(messages, options = {}) {
  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: messages,
      options: {
        model: options.model || 'llama-3.3-70b-versatile',
        temperature: options.temperature || 0.6,
        maxTokens: options.maxTokens || 2048,
        topP: options.topP || 0.95
      }
    })
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `API request failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'API call failed');
  }
  
  return data.response;
}

/**
 * Fetch report from server
 */
export async function fetchReport(patientName) {
  const response = await fetch(`/api/get_report?patient_name=${encodeURIComponent(patientName)}`);
  
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch report: ${response.status}`);
  }
  
  const data = await response.json();
  return data.success ? data.report : null;
}

/**
 * Search reports
 */
export async function searchReports(query) {
  const response = await fetch(`/api/search_reports?query=${encodeURIComponent(query)}`);
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.success ? data.matches : [];
}

/**
 * Get all patients
 */
export async function getPatients() {
  const response = await fetch('/api/get_patients');
  
  if (!response.ok) {
    throw new Error(`Failed to get patients: ${response.status}`);
  }
  
  const data = await response.json();
  return data.success ? data.patients : [];
}

/**
 * Save report
 */
export async function saveReport(reportData) {
  const response = await fetch('/api/save_report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save report: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Check if API key is configured (async now)
 */
export async function isAPIConfigured() {
  return await checkAPIStatus();
}
