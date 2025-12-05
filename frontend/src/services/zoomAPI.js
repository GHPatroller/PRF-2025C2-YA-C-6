let meetingData = null;

export const zoomAPI = {
  setMeetingData: (data) => {
    meetingData = data;
    console.log("📦 Meeting data stored from iframe:", data);
  },

  getMeetingData: () => {
    return meetingData;
  },

  getRole: () => {
    return meetingData?.role ?? 0; // 0 = alumno por defecto
  },

  isReady: () => {
    return (
      meetingData !== null &&
      meetingData.meetingNumber &&
      meetingData.signature
    );
  },

  clearMeetingData: () => {
    meetingData = null;
  }
};
