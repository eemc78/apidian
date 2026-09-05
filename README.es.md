<<<<<<< HEAD
# @eemc78/apidian

API de integración con la DIAN (Colombia) para Facturación Electrónica y consulta de documentos. Esta aplicación puede ser ejecutada de manera independiente como un servidor Express o utilizada como librería (módulo) dentro de otros proyectos Node.js.

## Instalación

Para instalar el paquete usando NPM:

```bash
npm install @eemc78/apidian
```

## Uso como Librería

Si deseas integrar las funcionalidades de esta API directamente en tu aplicación Node.js sin levantar el servidor Express, puedes hacerlo así:

```javascript
const dianLib = require('@eemc78/apidian');

async function consultarFactura() {
  // 1. Inicializar la configuración
  // Esto configurará las credenciales y la base de datos subyacente.
  await dianLib.init({
    certPath: './ruta/al/certificado.p12', // Requerido: Ruta al certificado digital p12
    certPassword: 'password_certificado',  // Requerido: Contraseña del certificado
    dbDialect: 'sqlite'                    // Opcional: sqlite, postgres, mysql
  });

  // 2. Realizar consultas a los servicios de la DIAN
  try {
    const respuesta = await dianLib.dianService.consultarYActualizar('FACTURA', {
      nit: '900673722',
      trackId: 'uuid-track-id-generado-por-la-dian'
    });
    
    console.log("Respuesta de la DIAN:", respuesta);
  } catch (error) {
    console.error("Error al consultar:", error);
  }
}

consultarFactura();
```

## Uso como Servidor Independiente (Standalone)

El paquete incluye un servidor Express embebido que expone endpoints REST para comunicarse con la DIAN.

### Opción A: Desde el código de tu aplicación

```javascript
const dianLib = require('@eemc78/apidian');

// Levanta el servidor en el puerto 3009
dianLib.startApiServer(3009)
  .then((app) => {
    console.log("Servidor @eemc78/apidian levantado exitosamente.");
  })
  .catch((err) => console.error("Error arrancando el servidor", err));
```

### Opción B: Ejecución directa por consola

Si clonas el repositorio o instalas de forma global:

1. Crea tu archivo `.env` basado en la configuración necesaria:
```env
PORT=3009
DB_DIALECT=sqlite
CERT_PATH=./uploads/certificates
CERT_FILENAME=MI_CERTIFICADO.p12
CERT_PASSWORD=password
```

2. Arranca el servidor:
```bash
npm start
```

## Licencia
MIT
=======
# apidian
API para consultar las resoluciones y consultar documentos ante la DIAN 
>>>>>>> e61d2004b3bf99161085769277323fa35221fedf
