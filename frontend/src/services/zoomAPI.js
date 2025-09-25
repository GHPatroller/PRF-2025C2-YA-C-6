const API_BASE = 'http://localhost:3000';

export const zoomAPI = {
  createMeeting: async () => {
    const response = await fetch(`${API_BASE}/create-meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  getSignature: async (meetingNumber, role = 1) => {
    const response = await fetch(`${API_BASE}/get-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingNumber, role }),
    });
    return response.json();
  }
};