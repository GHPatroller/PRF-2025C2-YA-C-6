<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/zoom/lib.php');
require_once(__DIR__ . '/vendor/autoload.php'); // Para JWT

use Firebase\JWT\JWT;

// 1. Recibir parámetros y validar seguridad
$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomforeducationv1', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);

require_login($course, true, $cm);

// --- PARCHE DE SEGURIDAD (CSP) ---
if (!headers_sent()) {
    header_remove("Content-Security-Policy");
    header_remove("X-Frame-Options");

    $csp = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: gap:; ";
    $csp .= "script-src * 'unsafe-inline' 'unsafe-eval' blob:; ";
    $csp .= "worker-src * blob:; ";
    $csp .= "connect-src * 'unsafe-inline' blob:; ";
    $csp .= "img-src * data: blob:; ";
    $csp .= "style-src * 'unsafe-inline'; ";
    $csp .= "font-src * data:; ";
    $csp .= "frame-src *; ";

    header("Content-Security-Policy: " . $csp);
}

// --- LÓGICA DE NEGOCIO Y FIRMA ---

// Buscar la reunión Zoom del curso (COMENTADO - usando valores mock)
$zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);
if (!$zoom) {
    echo "No hay reunión Zoom asignada a este curso.";
    exit;
}
$meetingNumber = $zoom->meeting_id;
$meetingPassword = $zoom->password;


$context = context_module::instance($cm->id);
$isTeacher = has_capability('mod/zoom:addinstance', $context) || 
             has_capability('moodle/course:manageactivities', $context);
$role = $isTeacher ? 1 : 0;

// 🔑 Claves del SDK
$sdkKey = 'ivAxPv8jS2maS22Cbj6gpA';
$sdkSecret = 'Z8Sw5sOVl5QbN8Ol7PxGm1b0EonQScjj';

// 🧮 Generar la firma
$iat = time() - 60;
$exp = $iat + 2 * 60 * 60;

$payload = [
    'sdkKey'   => $sdkKey,
    'appKey'   => $sdkKey,
    'mn'       => (string)$meetingNumber,
    'role'     => (int)$role,
    'iat'      => $iat,
    'exp'      => $exp,
    'tokenExp' => $exp
];

try {
    $signature = JWT::encode($payload, $sdkSecret, 'HS256');
} catch (Exception $e) {
    echo 'Error generando firma: ' . $e->getMessage();
    exit;
}

// Preparamos los datos para la app (similar a meetingData en view.php)
$app_config = [
    'meetingNumber' => $meetingNumber,
    'password'      => $meetingPassword,
    'role'          => $role,
    'sdkKey'        => $sdkKey,
    'signature'     => $signature,
    'user'          => [
        'id'        => $USER->id,
        'username'  => $USER->username,
        'firstname' => $USER->firstname,
        'lastname'  => $USER->lastname,
        'fullname'  => fullname($USER),
        'email'     => $USER->email
    ]
];

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="ui/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zoom Class</title>
    
    <!-- Inyectamos la configuración inicial antes de cargar la app React -->
    <script type="text/javascript">
        window.ZOOM_MEETING_CONFIG = <?php echo json_encode($app_config); ?>;
        const iframe = document.getElementById("zoomAppFrame");

    const meetingData = {
        meetingNumber: "<?php echo $meetingNumber; ?>",
        password: "<?php echo $meetingPassword; ?>",
        role: <?php echo $app_config['role']; ?>,
        sdkKey: "<?php echo $app_config['sdkKey']; ?>",
        signature: "<?php echo $app_config['signature']; ?>",
        user: {
            id: <?php echo $app_config['user']['id']; ?>,
            username: "<?php echo $app_config['user']['username']; ?>",
            firstname: "<?php echo $app_config['user']['firstname']; ?>",
            lastname: "<?php echo $app_config['user']['lastname']; ?>",
            fullname: "<?php echo $app_config['user']['fullname']; ?>",
            email: "<?php echo $app_config['user']['email']; ?>"
        }
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
            }, "<?php echo $CFG->wwwroot; ?>/mod/zoomforeducationv1/iframe.php");
            retryCount++;
        }
    }

    // Escuchar confirmación del iframe
    window.addEventListener("message", (event) => {
        if (event.origin === "<?php echo $CFG->wwwroot; ?>/mod/zoomforeducationv1/iframe.php") {
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
</head>
<body>
    <div id="root"></div>
    
    <script type="module" crossorigin src="ui/assets/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>