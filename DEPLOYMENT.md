# Guía de Despliegue - Zoom For Education v1

Esta guía explica cómo compilar y desplegar el plugin de Moodle Zoom For Education.

## 📋 Requisitos Previos

- Node.js 16+ y npm
- Git
- Acceso a una instancia de Moodle
- Credenciales del SDK de Zoom

## 🏗️ Compilación del Frontend

El frontend de React debe compilarse antes del despliegue. La salida de la compilación va a `zoomforeducationv1/ui/` y **debe ser confirmada en el control de versiones**.

### Compilación Rápida (Recomendada)

**En Linux/Mac:**
```bash
./build.sh
```

**En Windows:**
```bash
build.bat
```

### Compilación Manual

```bash
cd frontend
npm install
npm run build
cd ..
```

Esto hará:
1. Instalar todas las dependencias
2. Compilar la aplicación React
3. Generar la salida en `zoomforeducationv1/ui/`

## 📦 Qué se Genera en la Compilación

El proceso de compilación genera:

```
zoomforeducationv1/ui/
├── assets/
│   ├── index.js       # Bundle principal de la aplicación
│   ├── index.es.js    # Versión ES module
│   └── purify.es.js   # Librería DOMPurify
├── index.html         # HTML generado (no se usa)
└── vite.svg          # Favicon
```

## ⚠️ Notas Importantes

### SÍ Confirmar la Compilación

**El directorio `zoomforeducationv1/ui/` DEBE ser confirmado en git.**

```bash
git add zoomforeducationv1/ui/
git commit -m "Actualizar compilación del frontend"
git push
```

### ¿Por qué?

- Los servidores de Moodle pueden no tener Node.js instalado
- La compilación es necesaria para que el plugin funcione
- El despliegue se simplifica (no se necesita paso de compilación en el servidor)

## 🚀 Pasos de Despliegue

### 1. Compilar el Frontend

```bash
./build.sh  # o build.bat en Windows
```

### 2. Confirmar los Cambios

```bash
git add .
git commit -m "Actualizar plugin con última compilación del frontend"
git push
```

### 3. Desplegar en Moodle

**Opción A: Vía Git (Recomendada)**
```bash
cd /ruta/a/moodle/mod/
git clone <url-de-tu-repo> zoomforeducationv1
# o
git pull  # si ya está clonado
```

**Opción B: Carga Manual**
1. Comprimir el directorio `zoomforeducationv1/`
2. Subir al directorio `mod/` de Moodle
3. Extraer el zip

### 4. Instalar/Actualizar en Moodle

1. Iniciar sesión como administrador
2. Navegar a: **Administración del sitio → Notificaciones**
3. Moodle detectará el plugin nuevo/actualizado
4. Hacer clic en "Actualizar base de datos de Moodle ahora"

## 🔧 Configuración

Después de la instalación, configurar:

1. **Credenciales del SDK de Zoom** (en `iframe.php`):
   - `$sdkKey`
   - `$sdkSecret`

2. **Configuración de la Reunión**:
   - El plugin lee los datos de la reunión de la tabla `mod_zoom`
   - Asegurarse de que el plugin estándar de Zoom esté instalado

## 🐛 Solución de Problemas

### Falla la Compilación

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### La Aplicación Muestra Pantalla en Blanco

**Causa:** Archivos de compilación faltantes o desactualizados

**Solución:**
```bash
./build.sh  # Recompilar
git add zoomforeducationv1/ui/
git commit -m "Regenerar compilación del frontend"
```

### Los Cambios No Aparecen

**Causa:** Caché del navegador o compilación no regenerada

**Solución:**
1. Recompilar: `./build.sh`
2. Limpiar caché del navegador (Ctrl+Shift+R)
3. Verificar que `iframe.php` tenga cache-busting: `?v=<?php echo time(); ?>`

### Error "No routes matched"

**Causa:** Problema de configuración de React Router

**Solución:** Verificar que `App.jsx` use `HashRouter` (no `BrowserRouter`)

## 📁 Estructura de Directorios

```
PRF-2025C2-YA-C-6/
├── frontend/              # Código fuente React (desarrollo)
│   ├── src/
│   ├── package.json
│   └── vite.config.js    # Configuración de compilación (salida a ../zoomforeducationv1/ui)
│
├── zoomforeducationv1/    # Plugin de Moodle (producción)
│   ├── ui/               # ⚠️ FRONTEND COMPILADO (¡confirmar en git!)
│   ├── iframe.php        # Punto de entrada
│   ├── view.php          # Integración con Moodle
│   └── version.php       # Metadatos del plugin
│
├── build.sh              # Script de compilación (Linux/Mac)
└── build.bat             # Script de compilación (Windows)
```

## 🔄 Flujo de Trabajo de Desarrollo

### Durante el Desarrollo

```bash
cd frontend
npm run dev  # Iniciar servidor de desarrollo en localhost:5173
```

### Antes de Confirmar

```bash
./build.sh              # Compilar versión de producción
git add .
git commit -m "..."
git push
```

### Antes de Desplegar en Moodle

```bash
git pull                # Obtener últimos cambios
./build.sh              # Asegurar que la compilación esté actualizada
# Desplegar en servidor de Moodle
```

## 📝 Control de Versiones

### Archivos Rastreados en Git

✅ **SÍ confirmar:**
- `zoomforeducationv1/ui/` (compilación de producción)
- `frontend/src/` (código fuente)
- `frontend/package.json`
- `frontend/vite.config.js`

❌ **NO confirmar:**
- `frontend/node_modules/`
- `frontend/dist/` (directorio de compilación antiguo, no se usa)
- Archivos `.env` con secretos

### Configuración de .gitignore

El `.gitignore` está configurado para:
- Ignorar `node_modules`
- Ignorar `dist` (predeterminado antiguo de Vite)
- **NO ignorar** `zoomforeducationv1/ui/` (necesario para el despliegue)

## 🆘 Soporte

Si encuentras problemas:

1. Consulta la sección de solución de problemas de esta guía
2. Verifica la versión de Node.js: `node --version` (debe ser 16+)
3. Revisa los logs de error de Moodle
4. Revisa la consola del navegador para errores de JavaScript

## 📚 Recursos Adicionales

- [Documentación de Vite](https://vitejs.dev/)
- [Documentación de React](https://react.dev/)
- [Desarrollo de Plugins de Moodle](https://docs.moodle.org/dev/Main_Page)
- [SDK de Reuniones de Zoom](https://developers.zoom.us/docs/meeting-sdk/)

