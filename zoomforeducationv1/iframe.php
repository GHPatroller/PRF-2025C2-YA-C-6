<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/zoomedu/classes/utils.php');

// 1. Recibir parámetros y validar seguridad (Igual que en view.php)
$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomedu', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$zoomedu = $DB->get_record('zoomedu', array('id' => $cm->instance), '*', MUST_EXIST);

require_login($course, true, $cm);

// --- PARCHE DE SEGURIDAD (CSP) CORREGIDO ---
if (!headers_sent()) {
    // 1. Limpiamos lo que haya puesto Moodle
    header_remove("Content-Security-Policy");
    header_remove("X-Frame-Options");

    // 2. La política "Canilla Libre" para Zoom
    // AGREGAMOS 'blob:' en script-src y worker-src (CRÍTICO)
    $csp = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: gap:; ";
    $csp .= "script-src * 'unsafe-inline' 'unsafe-eval' blob:; "; // <--- Aca faltaba el blob:
    $csp .= "worker-src * blob:; "; // <--- Esto es especifico para los workers de video
    $csp .= "connect-src * 'unsafe-inline' blob:; ";
    $csp .= "img-src * data: blob:; ";
    $csp .= "style-src * 'unsafe-inline'; ";
    $csp .= "font-src * data:; ";
    $csp .= "frame-src *; "; // Permite iframes anidados si Zoom los necesita

    header("Content-Security-Policy: " . $csp);
}

// --- LÓGICA DE NEGOCIO Y FIRMA ---
// Datos de la reunión
$meetingNumber = $zoom->meeting_id;
$meetingPassword = $zoom->password;
$role = 0; // 0 = Alumno. (Acá podrías meter un if ($PAGE->user_is_editing) $role = 1;)

// Generamos la firma JWT segura en el servidor
$signature = \mod_zoomedu\utils::generate_signature($meeting_number, $role);

// Preparamos el objeto de configuración para React
$app_config = [
    'meetingNumber' => $meeting_number,
    'userName'      => $USER->firstname . ' ' . $USER->lastname,
    'userEmail'     => $USER->email,
    'passWord'      => trim(strip_tags($zoomedu->passcode)),
    'leaveUrl'      => $CFG->wwwroot . '/course/view.php?id=' . $course->id,
    'apiKey'        => 'cTcrFpleSTCmj3zek0HtFA',
    'signature'     => $signature
];

// --- RENDERIZADO (APP COMPILADA) ---
// No usamos $OUTPUT->header() para tener control total del DOM y evitar CSS de Moodle
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo s($zoomedu->name); ?></title>
    
    <script>
        window.ZOOM_EDU_CONFIG = <?php echo json_encode($app_config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
        console.log("🛠️ Config recibida desde PHP:", window.ZOOM_EDU_CONFIG);
    </script>

    <link rel="stylesheet" crossorigin href="ui/assets/index.css?v=<?php echo time(); ?>">
    
    <style>
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
        #root { width: 100%; height: 100%; }
    </style>
</head>
<body>
    <div id="root"></div>
    
    <script type="module" crossorigin src="ui/assets/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>