<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/zoom/lib.php');
require_once(__DIR__ . '/vendor/autoload.php'); // Para JWT

use Firebase\JWT\JWT;

// 1. Recibir parámetros y validar seguridad
$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomforeducationv1', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
// Note: The instance table is 'zoom' based on view.php, but the module is 'zoomforeducationv1'. 
// However, view.php used $DB->get_record('zoom', ['course' => $course->id]).
// Let's stick to what view.php was doing regarding data retrieval, but we need the instance id from cm if possible.
// view.php logic:
// $zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);
// This seems to imply one zoom meeting per course? Or maybe the instance id in cm points to something else?
// In view.php: $cm->instance usually points to the id in the module's table.
// If the module is 'zoomforeducationv1', there should be a table 'zoomforeducationv1'.
// BUT view.php was doing: $zoom = $DB->get_record('zoom', ['course' => $course->id]...
// This suggests the data is in 'zoom' table (maybe from the standard zoom plugin?).
// Let's replicate view.php's logic for getting meeting data.

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

// Buscar la reunión Zoom del curso (Logic from view.php)
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
<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/zoom/lib.php');
require_once(__DIR__ . '/vendor/autoload.php'); // Para JWT

use Firebase\JWT\JWT;

// 1. Recibir parámetros y validar seguridad
$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomforeducationv1', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
// Note: The instance table is 'zoom' based on view.php, but the module is 'zoomforeducationv1'. 
// However, view.php used $DB->get_record('zoom', ['course' => $course->id]).
// Let's stick to what view.php was doing regarding data retrieval, but we need the instance id from cm if possible.
// view.php logic:
// $zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);
// This seems to imply one zoom meeting per course? Or maybe the instance id in cm points to something else?
// In view.php: $cm->instance usually points to the id in the module's table.
// If the module is 'zoomforeducationv1', there should be a table 'zoomforeducationv1'.
// BUT view.php was doing: $zoom = $DB->get_record('zoom', ['course' => $course->id]...
// This suggests the data is in 'zoom' table (maybe from the standard zoom plugin?).
// Let's replicate view.php's logic for getting meeting data.

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

// Buscar la reunión Zoom del curso (Logic from view.php)
//$zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);

//if (!$zoom) {
//    echo "No hay reunión Zoom asignada a este curso.";
//    exit;
//}

$meetingNumber = '79601982203';
$meetingPassword = '1U12by';

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
<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/zoom/lib.php');
require_once(__DIR__ . '/vendor/autoload.php'); // Para JWT

use Firebase\JWT\JWT;

// 1. Recibir parámetros y validar seguridad
$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomforeducationv1', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
// Note: The instance table is 'zoom' based on view.php, but the module is 'zoomforeducationv1'. 
// However, view.php used $DB->get_record('zoom', ['course' => $course->id]).
// Let's stick to what view.php was doing regarding data retrieval, but we need the instance id from cm if possible.
// view.php logic:
// $zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);
// This seems to imply one zoom meeting per course? Or maybe the instance id in cm points to something else?
// In view.php: $cm->instance usually points to the id in the module's table.
// If the module is 'zoomforeducationv1', there should be a table 'zoomforeducationv1'.
// BUT view.php was doing: $zoom = $DB->get_record('zoom', ['course' => $course->id]...
// This suggests the data is in 'zoom' table (maybe from the standard zoom plugin?).
// Let's replicate view.php's logic for getting meeting data.

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

// Buscar la reunión Zoom del curso (Logic from view.php)
//$zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);

//if (!$zoom) {
//    echo "No hay reunión Zoom asignada a este curso.";
//    exit;
//}

$meetingNumber = '79601982203';
$meetingPassword = '1U12by';

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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zoom Class</title>
    
    <!-- Inyectamos la configuración inicial -->
<body>
    <div id="root"></div>
    
    <script type="module" crossorigin src="ui/assets/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>