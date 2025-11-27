# Informe de Revisión de Seguridad: Integración Moodle + Zoom Meeting SDK

## 1. Resumen Ejecutivo
Se ha realizado una revisión de seguridad del código fuente proporcionado, centrándose en la integración entre el plugin de Moodle (`view.php`) y la aplicación React (frontend) que utiliza el Zoom Meeting SDK.

Se han identificado **vulnerabilidades críticas** relacionadas con la gestión de credenciales que deben ser corregidas antes de cualquier despliegue en producción. Además, se han encontrado áreas de mejora en la comunicación entre componentes y la configuración del entorno.

## 2. Hallazgos Críticos

### 🚨 Credenciales Hardcodeadas (Alto Riesgo)
**Archivo:** `viewphp/view.php` (Líneas 38-39)

Se encontraron las claves del SDK (`$sdkKey` y `$sdkSecret`) escritas directamente en el código fuente:

```php
$sdkKey = 'ivAxPv8jS2maS22Cbj6gpA';
$sdkSecret = 'Z8Sw5sOVl5QbN8Ol7PxGm1b0EonQScjj';
```

**Riesgo:** Si este código se comparte, se sube a un repositorio público o se expone, un atacante podría utilizar estas credenciales para generar firmas válidas, hacerse pasar por su aplicación, consumir su cuota de uso o realizar ataques de denegación de servicio.

**Recomendación:**
*   **Eliminar inmediatamente** las credenciales del código fuente.
*   Utilizar la API de configuración de plugins de Moodle (`get_config`) para almacenar estas claves de forma segura en la base de datos.
*   Crear un formulario de configuración (`settings.php`) para el plugin donde el administrador pueda ingresar estas claves.

## 3. Hallazgos de Riesgo Medio/Bajo

### ⚠️ Validación de Origen Insegura (Medio Riesgo)
**Archivo:** `frontend/src/hooks/useIframeMessaging.js` (Líneas 9-17)

La validación del origen de los mensajes `postMessage` es permisiva:

```javascript
const allowedOrigins = [
    'http://localhost',
    'http://localhost:80',
    window.location.origin
];

const isAllowedOrigin = allowedOrigins.some(origin =>
    event.origin.startsWith(origin) // ❌ startsWith es inseguro
);
```

**Riesgo:** El uso de `startsWith` permite que dominios maliciosos como `http://localhost.attacker.com` pasen la validación. Además, la lista de orígenes permitidos está hardcodeada para desarrollo.

**Recomendación:**
*   Utilizar comparación estricta (`===`) en lugar de `startsWith`.
*   Configurar la URL de Moodle permitida a través de variables de entorno (ej. `VITE_MOODLE_URL`) en el momento de la construcción (build).

### ⚠️ URLs de Desarrollo Hardcodeadas
**Archivo:** `viewphp/view.php` (Líneas 68, 106)

El iframe apunta fijamente a `http://localhost:5173`.

```php
src="http://localhost:5173"
```

**Riesgo:** Esto impedirá que el plugin funcione en un entorno de producción o en cualquier servidor que no sea la máquina de desarrollo local.

**Recomendación:**
*   Hacer configurable la URL del frontend en los ajustes del plugin de Moodle.
*   Para producción, se recomienda servir los archivos estáticos del build de React desde el propio plugin de Moodle o un CDN/servidor web dedicado, no desde un servidor de desarrollo Vite.

## 4. Revisión de Implementación del SDK

### Generación de Firma (Correcto)
**Archivo:** `viewphp/view.php`
La generación del JWT para la firma parece correcta y sigue los estándares de Zoom Meeting SDK:
*   Utiliza `HS256`.
*   Incluye los campos requeridos (`sdkKey`, `mn`, `role`, `iat`, `exp`, `tokenExp`).
*   El tiempo de expiración (2 horas) es razonable.

### Versión del SDK (Correcto)
**Archivo:** `frontend/package.json`
Se está utilizando `@zoom/meetingsdk: ^4.0.7`, que es una versión reciente y mantenida.

## 5. Análisis de Medidas de Seguridad Existentes (Educativo)

A continuación, se explica cómo funcionan las medidas de seguridad que **ya están implementadas** correctamente en el proyecto y por qué son importantes:

### A. Autenticación y Contexto de Moodle
En `view.php`, la línea:
```php
require_login($course, true, $cm);
```
Es la primera y más importante barrera de defensa.
*   **¿Qué hace?**: Verifica que el usuario tenga una sesión activa en Moodle y que esté matriculado o tenga permiso para acceder a este curso específico.
*   **Por qué es seguro**: Impide que cualquier persona con el enlace directo pueda acceder a la videollamada. Delega la autenticación completamente en Moodle, aprovechando su robustez.

### B. Control de Roles (Server-Side)
El código determina el rol del usuario (Profesor/Host vs Estudiante/Participante) en el servidor:
```php
$isTeacher = has_capability('mod/zoom:addinstance', $context) || ...
$role = $isTeacher ? 1 : 0;
```
*   **¿Qué hace?**: Consulta los permisos reales del usuario en la base de datos de Moodle para decidir si debe entrar como anfitrión (1) o participante (0).
*   **Por qué es seguro**: Al hacerse en el servidor (PHP), el usuario no puede manipular este valor. Si esta lógica estuviera en el frontend (JavaScript), un estudiante astuto podría modificar la variable y entrar como profesor.

### C. Firma JWT (JSON Web Token)
La generación de la firma (`$signature`) es el mecanismo central de seguridad de Zoom.
```php
$signature = JWT::encode($payload, $sdkSecret, 'HS256');
```
*   **¿Qué hace?**: Crea un "sello digital" criptográfico que incluye el número de reunión, el rol y la expiración.
*   **Por qué es seguro**:
    1.  **Integridad**: Si alguien intenta cambiar su rol de 0 a 1 en el camino, la firma dejará de coincidir y Zoom rechazará la conexión.
    2.  **Secreto**: La firma se genera usando el `$sdkSecret`. Como este secreto (idealmente) nunca sale del servidor, nadie más puede generar firmas válidas para tu cuenta. El frontend solo recibe la firma final, nunca el secreto.

### D. Comunicación vía `postMessage`
El intercambio de datos entre Moodle (PHP) y React (Iframe) se hace mediante mensajes:
```javascript
iframe.contentWindow.postMessage({ ... }, "http://localhost:5173");
```
*   **¿Qué hace?**: Envía los datos sensibles (como la firma y el ID de reunión) directamente a la ventana del iframe.
*   **Por qué es seguro (conceptualmente)**: A diferencia de pasar datos por la URL (ej. `iframe.src = "...?signature=xyz"`), `postMessage` no deja rastro en el historial del navegador ni en los logs del servidor web. Esto reduce el riesgo de que la firma sea interceptada accidentalmente.

## 6. Plan de Acción Recomendado

1.  **Refactorizar `view.php`**:
    *   Reemplazar las variables hardcodeadas por llamadas a `get_config('mod_zoom', 'sdk_key')`.
2.  **Crear `settings.php`**:
    *   Añadir campos para `sdk_key`, `sdk_secret` y `frontend_url` en la configuración del plugin.
3.  **Refactorizar `useIframeMessaging.js`**:
    *   Implementar validación estricta de orígenes.
    *   Usar variables de entorno para definir el origen de confianza.
4.  **Rotación de Credenciales**:
    *   Dado que las claves actuales han sido expuestas en este análisis (y posiblemente en otros lugares), se recomienda **revocar y regenerar** las credenciales del SDK en el Marketplace de Zoom.
