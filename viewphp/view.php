<?php
require(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/zoom/lib.php');
require_once(__DIR__ . '/vendor/autoload.php'); // Para JWT

use Firebase\JWT\JWT;

$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomforeducationv1', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);

require_login($course, true, $cm);

echo $OUTPUT->header();
echo $OUTPUT->heading('Zoom del curso');

// Buscar la reunión Zoom del curso
$zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);
if (!$zoom) {
    echo $OUTPUT->notification('No hay reunión Zoom asignada a este curso.', 'notifyproblem');
    echo $OUTPUT->footer();
    exit;
}

// Datos de la reunión
$meetingNumber = $zoom->meeting_id;
$meetingPassword = $zoom->password;
$role = 0; // 0 = participante, 1 = host

// 🔑 Claves del SDK
$sdkKey = 'ivAxPv8jS2maS22Cbj6gpA';
$sdkSecret = 'Z8Sw5sOVl5QbN8Ol7PxGm1b0EonQScjj';

// 🧮 Generar la firma directamente acá
$iat = time() - 60; // Restar 60s para evitar problemas de sincronización de reloj
$exp = $iat + 2 * 60 * 60;

$payload = [
    'sdkKey' => $sdkKey, // Requerido en versiones nuevas
    'appKey' => $sdkKey, // Mantener por compatibilidad
    'mn'     => (string)$meetingNumber,
    'role'   => (int)$role,
    'iat'    => $iat,
    'exp'    => $exp,
    'tokenExp' => $exp
];

try {
    $signature = JWT::encode($payload, $sdkSecret, 'HS256');
} catch (Exception $e) {
    echo $OUTPUT->notification('Error generando firma: ' . $e->getMessage(), 'notifyproblem');
    echo $OUTPUT->footer();
    exit;
}

?>

<!-- Contenedor del iframe que carga tu app React -->
<iframe
    id="zoomAppFrame"
    src="http://localhost:5173"
    width="100%"
    height="85vh"
    style="border: none; min-height: 600px;"></iframe>

<script>
    const iframe = document.getElementById("zoomAppFrame");

    const meetingData = {
        meetingNumber: "<?php echo $meetingNumber; ?>",
        password: "<?php echo $meetingPassword; ?>",
        role: <?php echo $role; ?>,
        sdkKey: "<?php echo $sdkKey; ?>",
        signature: "<?php echo $signature; ?>"
    };

    console.log("📦 Datos de reunión preparados:", meetingData);

    let messageSent = false;
    let retryCount = 0;
    const maxRetries = 10;

    // Función para enviar el mensaje
    function sendMeetingData() {
        if (!messageSent && iframe.contentWindow) {
            console.log("📤 Enviando datos al iframe (intento " + (retryCount + 1) + ")");
            iframe.contentWindow.postMessage({
                action: "initZoomMeeting",
                payload: meetingData
            }, "http://localhost:5173");
            retryCount++;
        }
    }

    // Escuchar confirmación del iframe
    window.addEventListener("message", (event) => {
        if (event.origin === "http://localhost:5173") {
            console.log("📨 Mensaje recibido del iframe:", event.data);
            
            if (event.data.action === "reactAppReady") {
                console.log("✅ React app está lista, enviando datos...");
                sendMeetingData();
                messageSent = true;
            }
        }
    });

    // Enviar cuando el iframe cargue
    iframe.addEventListener("load", () => {
        console.log("🔄 Iframe cargado, esperando confirmación de React...");
        
        // Intentar enviar inmediatamente
        setTimeout(sendMeetingData, 500);
        
        // Reintentar cada segundo si no se confirmó
        const retryInterval = setInterval(() => {
            if (messageSent || retryCount >= maxRetries) {
                clearInterval(retryInterval);
                if (!messageSent) {
                    console.error("❌ No se pudo establecer comunicación con el iframe");
                }
            } else {
                sendMeetingData();
            }
        }, 1000);
    });
</script>

<?php
echo $OUTPUT->footer();
