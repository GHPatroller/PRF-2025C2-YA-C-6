<?php
require(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/zoom/lib.php');

$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('zoomforeducationv1', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);

require_login($course, true, $cm);

echo $OUTPUT->header();
echo $OUTPUT->heading('Zoom del curso');

// Buscar la reunión Zoom del curso para validar que existe antes de cargar el iframe
$zoom = $DB->get_record('zoom', ['course' => $course->id], '*', IGNORE_MULTIPLE);
if (!$zoom) {
    echo $OUTPUT->notification('No hay reunión Zoom asignada a este curso.', 'notifyproblem');
    echo $OUTPUT->footer();
    exit;
}

$iframe_url = new moodle_url('/mod/zoomforeducationv1/iframe.php', array('id' => $cm->id));

?>

<iframe
    id="zoomAppFrame"
    src="<?php echo $iframe_url->out(false); ?>"
    width="100%"
    height="85vh"
    style="border: none; min-height: 600px;"
    allow="camera; microphone; fullscreen; autoplay; clipboard-read; clipboard-write"
    allowfullscreen>
</iframe>

<?php
echo $OUTPUT->footer();
