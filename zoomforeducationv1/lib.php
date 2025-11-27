<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Library of interface functions and constants.
 *
 * @package     mod_zoomforeducationv1
 * @copyright   2025 Your Name <you@example.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Return if the plugin supports $feature.
 *
 * @param string $feature Constant representing the feature.
 * @return true | null True if the feature is supported, null otherwise.
 */
function zoomforeducationv1_supports($feature)
{
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        default:
            return null;
    }
}

/**
 * Saves a new instance of the mod_zoomforeducationv1 into the database.
 *
 * Given an object containing all the necessary data, (defined by the form
 * in mod_form.php) this function will create a new instance and return the id
 * number of the instance.
 *
 * @param object $moduleinstance An object from the form.
 * @param mod_zoomforeducationv1_mod_form $mform The form.
 * @return int The id of the newly inserted record.
 */
function zoomforeducationv1_add_instance($data, $mform)
{
    global $DB;
    $data->timemodified = time();
    return $DB->insert_record('zoomforeducationv1', $data);
}

function zoomforeducationv1_update_instance($data, $mform)
{
    global $DB;
    $data->timemodified = time();
    return $DB->update_record('zoomforeducationv1', $data);
}

function zoomforeducationv1_delete_instance($id)
{
    global $DB;
    return $DB->delete_records('zoomforeducationv1', ['id' => $id]);
}
