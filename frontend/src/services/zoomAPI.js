let meetingData = null;

export const zoomAPI = {
  setMeetingData: (data) => {
    meetingData = data;
    console.log("📦 Meeting data stored from iframe:", data);
  },

  getMeetingData: () => {
    return meetingData;
  },

  isReady: () => {
    return meetingData !== null &&
      meetingData.meetingNumber &&
      meetingData.signature;
  },

  clearMeetingData: () => {
    meetingData = null;
  }
};
