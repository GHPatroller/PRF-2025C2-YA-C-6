import { useEffect, useRef } from 'react';
import { zoomAPI } from '../services/zoomAPI';

export const useIframeMessaging = () => {
    const hasReceivedData = useRef(false);

    useEffect(() => {
        const handleMessage = (event) => {
            const allowedOrigins = [
                'http://localhost',
                'http://localhost:80',
                window.location.origin
            ];

            const isAllowedOrigin = allowedOrigins.some(origin =>
                event.origin.startsWith(origin)
            );

            if (!isAllowedOrigin) {
                console.warn('❌ Message from unauthorized origin:', event.origin);
                return;
            }

            if (event.data?.action === 'initZoomMeeting') {
                const payload = event.data.payload;

                if (!payload?.meetingNumber || !payload?.signature) {
                    console.error('❌ Invalid meeting data received:', payload);
                    return;
                }

                console.log('📨 Received meeting data from Moodle:', payload);

                zoomAPI.setMeetingData(payload);
                hasReceivedData.current = true;

                if (window.parent) {
                    window.parent.postMessage({
                        action: 'meetingDataReceived',
                        success: true
                    }, event.origin);
                    console.log('✅ Sent acknowledgment to Moodle');
                }
            }
        };

        window.addEventListener('message', handleMessage);

        const sendReadySignal = () => {
            if (window.parent && window.parent !== window) {
                console.log('📤 Sending reactAppReady signal to parent');
                window.parent.postMessage({
                    action: 'reactAppReady'
                }, '*');
            }
        };

        sendReadySignal();

        const timeoutId = setTimeout(sendReadySignal, 100);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(timeoutId);
        };
    }, []);

    return {
        isReady: () => hasReceivedData.current && zoomAPI.isReady()
    };
};
