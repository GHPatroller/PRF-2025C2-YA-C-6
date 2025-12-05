import { useEffect, useRef } from 'react';
import { zoomAPI } from '../services/zoomAPI';

export const useIframeMessaging = () => {
    const hasReceivedData = useRef(false);

    useEffect(() => {
        // Función para cargar datos desde window.ZOOM_MEETING_CONFIG
        const loadMeetingDataFromWindow = () => {
            if (window.ZOOM_MEETING_CONFIG && !hasReceivedData.current) {
                const payload = window.ZOOM_MEETING_CONFIG;

                if (!payload?.meetingNumber || !payload?.signature) {
                    console.error('❌ Invalid meeting data in window.ZOOM_MEETING_CONFIG:', payload);
                    return false;
                }

                console.log('📨 Loaded meeting data from window.ZOOM_MEETING_CONFIG:', {
                    meetingNumber: payload.meetingNumber,
                    role: payload.role,
                    hasSignature: !!payload.signature,
                    user: payload.user
                });

                zoomAPI.setMeetingData(payload);
                hasReceivedData.current = true;

                // Notificar que los datos fueron recibidos (para mismo origen)
                window.postMessage({
                    action: 'meetingDataReceived',
                    success: true
                }, window.location.origin);
                
                console.log('✅ Meeting data loaded successfully from window object');
                return true;
            }
            return false;
        };

        // Intentar cargar inmediatamente
        if (loadMeetingDataFromWindow()) {
            return; // Ya cargó, no necesita hacer nada más
        }

        // Si no está disponible inmediatamente, escuchar mensajes (fallback para compatibilidad)
        const handleMessage = (event) => {
            // Aceptar mensajes del mismo origen (window.postMessage)
            if (event.source === window && event.data?.action === 'reactAppReady') {
                console.log('📤 React ready signal received');
                return;
            }

            // Compatibilidad con iframe (si se usa en el futuro)
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

                console.log('📨 Received meeting data via postMessage:', {
                    meetingNumber: payload.meetingNumber,
                    role: payload.role,
                    hasSignature: !!payload.signature,
                    user: payload.user
                });

                zoomAPI.setMeetingData(payload);
                hasReceivedData.current = true;

                // Enviar confirmación
                const targetWindow = event.source === window ? window : window.parent;
                targetWindow.postMessage({
                    action: 'meetingDataReceived',
                    success: true
                }, event.origin);
                console.log('✅ Sent acknowledgment');
            }
        };

        window.addEventListener('message', handleMessage);

        // Enviar señal de que React está listo
        window.postMessage({
            action: 'reactAppReady'
        }, window.location.origin);
        console.log('📤 React app ready signal sent');

        // Reintentar cargar datos después de un pequeño delay
        const retryTimeout = setTimeout(() => {
            loadMeetingDataFromWindow();
        }, 100);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(retryTimeout);
        };
    }, []);

    return {
        isReady: () => hasReceivedData.current && zoomAPI.isReady()
    };
};
