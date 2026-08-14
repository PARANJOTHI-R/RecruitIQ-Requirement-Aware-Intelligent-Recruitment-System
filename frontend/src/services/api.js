const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

/**
 * Normalizes backend responses to handle consistent error states.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMsg = "An error occurred on the server.";
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch (e) {
      // Cannot parse JSON, keep default message
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

/**
 * Screen resumes against a job description.
 * @param {FormData} formData - Contains 'job_description' and 'resumes'
 */
export async function processScreening(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/screen`, {
      method: "POST",
      body: formData,
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("Screening error:", error);
    throw error; // Re-throw to be handled by the UI
  }
}

/**
 * Get AI insights for a candidate.
 * @param {string} candidateId
 */
export async function getCandidateInsights(candidateId) {
  try {
    const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("Insights error:", error);
    throw error;
  }
}

/**
 * Ask a follow-up question about a candidate.
 * @param {string} candidateId
 * @param {string} question
 */
export async function askCandidateQuestion(candidateId, question) {
  try {
    const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/insights/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("Follow-up question error:", error);
    throw error;
  }
}
