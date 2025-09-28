const API_BASE = 'http://localhost:3000';

export const zoomAPI = {
  createMeeting: async () => {
    const response = await fetch(`${API_BASE}/create-meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    console.log("Reunión creada:", data);
    console.log("Meeting ID:", data.id);
    console.log("Join URL:", data.join_url);
    console.log("Meeting password:", data.password);

    return data;
  },

  getSignature: async (meetingNumber, role = 1) => {
    const response = await fetch(`${API_BASE}/get-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingNumber, role }),
    });
    const data = await response.json();

    console.log("📌 Firma generada:", data);
    return data;
  }
};
