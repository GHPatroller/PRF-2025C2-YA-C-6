<?php
require(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/vendor/autoload.php'); // Path a Composer autoload
require_login();

use Firebase\JWT\JWT;

$sdkKey = 'ivAxPv8jS2maS22Cbj6gpA';
$sdkSecret = 'Z8Sw5sOVl5QbN8Ol7PxGm1b0EonQScjj';

$meetingNumber = required_param('meetingNumber', PARAM_INT);
$role = required_param('role', PARAM_INT);

$iat = time();
$exp = $iat + 2 * 60 * 60;

$payload = [
    'appKey' => $sdkKey,
    'mn'     => (string)$meetingNumber,
    'role'   => (int)$role,
    'iat'    => $iat,
    'exp'    => $exp
];

// Generar JWT firmado con HS256
$jwt = JWT::encode($payload, $sdkSecret, 'HS256');

header('Content-Type: application/json');
echo json_encode(['signature' => $jwt]);
