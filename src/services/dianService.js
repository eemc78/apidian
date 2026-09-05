const logger = require('../utils/logger');
const { Documento, Tercero, Resolucion } = require('../models');
const sequelize = require('../config/database');
const DianSigner = require('../utils/signer');
const https = require('https');
const { DOMParser } = require('xmldom');
const { XMLSerializer } = require('xmldom');
const uuid = require('uuid');
const crypto = require('crypto');
const { SignedXml } = require('xml-crypto');

class DianService {
  constructor() {
    this.signer = null;
    this.endpoint = "https://vpfe.dian.gov.co/WcfDianCustomerServices.svc";
    
    // Inicializar inmediatamente al crear la instancia
    this.initialize();
  }

  initialize() {
    const certPath = process.env.CERT_PATH;
    const certFilename = process.env.CERT_FILENAME;
    const certPassword = process.env.CERT_PASSWORD;

    if (!certPath || !certFilename || !certPassword) {
      const msg = "Faltan variables de entorno: CERT_PATH, CERT_FILENAME o CERT_PASSWORD";
      logger.error(msg);
      throw new Error(msg);
    }

    try {
      logger.info(`Inicializando firmador con: Path=${certPath}, File=${certFilename}`);
      // Instanciar el signer que carga el .p12
      this.signer = new DianSigner(certPath, certFilename, certPassword);
      logger.info('✅ Firmador inicializado exitosamente.');
    } catch (err) {
      logger.error('❌ Fallo al inicializar el firmador:', err.message);
      throw err;
    }
  }

  /**
   * Método principal para consultar estado de documentos (Facturas, Notas Crédito, etc.)
   * IMPORTANTE: La DIAN requiere el 'trackId' devuelto al momento del envío para consultar el estado.
   * Si solo tienes el número de factura, debes tener el trackId guardado en tu BD asociado a ese documento.
   */
  async consultarYActualizar(tipo, datosConsulta) {
    if (!this.signer) {
      throw new Error("El servicio DIAN no se ha inicializado correctamente.");
    }

    const transaction = await sequelize.transaction();
    try {
      const { numero, nit, trackId } = datosConsulta;

      // Validación crítica: GetStatus necesita TrackId
      if (!trackId) {
        // Intentar buscar el trackId en la base de datos local si no se pasó
        const docLocal = await Documento.findOne({ 
          where: { numero, terceroNit: nit, tipoDocumento: tipo },
          attributes: ['trackId']
        });

        if (!docLocal || !docLocal.trackId) {
          throw {
            statusCode: 400,
            message: `No se puede consultar el estado sin el 'trackId'. Este se obtiene al enviar la factura. Verifique si el documento existe localmente con su trackId.`
          };
        }
        
        // Usar el trackId encontrado
        return await this._ejecutarConsultaEstado(docLocal.trackId, tipo, nit, transaction);
      }

      // Si se pasó el trackId directamente
      return await this._ejecutarConsultaEstado(trackId, tipo, nit, transaction);

    } catch (error) {
      await transaction.rollback();
      logger.error("Error en consultarYActualizar:", error);
      throw error; // Lanzar el error estructurado
    }
  }

  // Método interno auxiliar para ejecutar la consulta GetStatus
  async _ejecutarConsultaEstado(trackId, tipo, nit, transaction) {
    try {
      logger.info(`Consultando estado para TrackId: ${trackId}`);

      // 1. Construir SOAP para GetStatus
      const xmlData = this.buildGetStatusSoap(trackId);
      const signedSoapXml = this.signXml(xmlData, this.signer.getPrivateKeyPem(), this.signer.thumbprint);

      // 2. Enviar a DIAN
      const result = await this.sendRawSoap(signedSoapXml, 'GetStatus');

      // 3. Parsear respuesta
      const responseData = this.parseDianResponse(result);

      // 4. Actualizar Base de Datos
      await this.persistDocumentData(responseData, tipo, nit, trackId, transaction);

      await transaction.commit();
      
      return {
        success: true,
        data: responseData,
        message: "Documento consultado y actualizado correctamente"
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Método específico para consultar resoluciones de numeración (GetNumberingRange)
   */
  async consultarResoluciones(nit, softwareCode) {
    if (!this.signer) {
      throw new Error("El servicio DIAN no se ha inicializado correctamente.");
    }

    const transaction = await sequelize.transaction();
    try {
      logger.info(`Consultando resoluciones para NIT: ${nit}, Software: ${softwareCode}`);

       // 1. Construir XML obteniendo los IDs
    const xmlData = this.buildGetNumberingRangeSoap(nit, softwareCode);
    
    // 2. Firmar pasando el objeto con IDs
    const signedSoapXml = this.signXml(xmlData, this.signer.getPrivateKeyPem(), this.signer.thumbprint);
    
    const fs = require('fs');
    fs.writeFileSync('scratch/request.xml', signedSoapXml);
    logger.info("XML guardado en scratch/request.xml para depuración");

    // 3. Enviar...
    const result = await this.sendRawSoap(signedSoapXml, 'GetNumberingRange');

      // 4. Parsear respuesta
      const data = this.parseResolutionsResponse(result);

      // 5. Guardar en DB
      if (data && data.resolutions && data.resolutions.length > 0) {
        for (const res of data.resolutions) {
          await Resolucion.upsert({
            numeroResolucion: res.ResolutionNumber,
            fechaExpedicion: res.ResolutionDate ? new Date(res.ResolutionDate) : null,
            prefijo: res.Prefix,
            desde: parseInt(res.FromNumber) || 0,
            hasta: parseInt(res.ToNumber) || 0,
            estado: this.calcularEstado(res.ValidDateTo),
            technicalKey: res.TechnicalKey,
            fechaUltimaActualizacion: new Date()
          }, { transaction });
        }
        
        // Actualizar fecha de consulta del tercero
        await Tercero.upsert({
          nit: nit,
          fechaUltimaConsulta: new Date()
        }, { transaction });
      }

      await transaction.commit();
      return { success: true, data };

    } catch (error) {
      await transaction.rollback();
      logger.error("Error en consultarResoluciones:", error);
      throw {
        statusCode: 500,
        message: "Error consultando resoluciones",
        details: error.message
      };
    }
  }

  // --- MÉTODOS DE CONSTRUCCIÓN SOAP (Basados en tu archivo SOAP UI) ---


  /**
   * Construye y FIRMA el SOAP para GetNumberingRange
   */
 
  buildGetNumberingRangeSoap(nit, softwareCode) {
    const messageId = `urn:uuid:${uuid.v4()}`;
    const timestampId = `TS-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const securityId = `Security-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    
    // IDs únicos para los elementos que serán firmados
    const toId = `id-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const signatureId = `SIG-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const keyInfoId = `KI-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const strId = `STR-${uuid.v4().replace(/-/g, '').toUpperCase()}`;

    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
    
    const thumbprint = this.signer.thumbprint;
    const base64Cert = this.signer.getBase64Cert();

    // Construcción EXACTA siguiendo el orden del log de SOAP UI
    // Nota: El To va DESPUÉS del Security dentro del Header
    let soapEnvelope = 
      `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia">` +
        `<soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">` +
          `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" ` +
                         `xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
            `<wsu:Timestamp wsu:Id="${timestampId}">` +
              `<wsu:Created>${now}</wsu:Created>` +
              `<wsu:Expires>${expires}</wsu:Expires>` +
            `</wsu:Timestamp>` +
            `<wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ` +
                                      `ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" ` +
                                      `wsu:Id="X509-${thumbprint}">${base64Cert}</wsse:BinarySecurityToken>` +
          `</wsse:Security>` +
          `<wsa:Action>http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRange</wsa:Action>` +
          `<wsa:To wsu:Id="${toId}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">https://vpfe.dian.gov.co/WcfDianCustomerServices.svc</wsa:To>` +
        `</soap:Header>` +
        `<soap:Body>` +
          `<wcf:GetNumberingRange>` +
            `<wcf:accountCode>${nit}</wcf:accountCode>` +
            `<wcf:accountCodeT>${nit}</wcf:accountCodeT>` +
            `<wcf:softwareCode>${softwareCode}</wcf:softwareCode>` +
          `</wcf:GetNumberingRange>` +
        `</soap:Body>` +
      `</soap:Envelope>`;

    // Retornamos el objeto con los IDs necesarios para la firma
    return { xml: soapEnvelope.trim(), toId: toId, timestampId: timestampId, signatureId: signatureId, keyInfoId: keyInfoId, strId: strId };
  }



  /**
   * Construye el XML crudo y los IDs para GetStatus
   */
  buildGetStatusSoap(trackId) {
    const timestampId = `TS-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const securityId = `Security-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const toId = `id-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const signatureId = `SIG-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const keyInfoId = `KI-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    const strId = `STR-${uuid.v4().replace(/-/g, '').toUpperCase()}`;
    
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    const thumbprint = this.signer.thumbprint;
    const base64Cert = this.signer.getBase64Cert();

    let soapEnvelope = 
      `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia">` +
        `<soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">` +
          `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" ` +
                         `xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
            `<wsu:Timestamp wsu:Id="${timestampId}">` +
              `<wsu:Created>${now}</wsu:Created>` +
              `<wsu:Expires>${expires}</wsu:Expires>` +
            `</wsu:Timestamp>` +
            `<wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ` +
                                      `ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" ` +
                                      `wsu:Id="X509-${thumbprint}">${base64Cert}</wsse:BinarySecurityToken>` +
          `</wsse:Security>` +
          `<wsa:Action>http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatus</wsa:Action>` +
          `<wsa:To wsu:Id="${toId}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">https://vpfe.dian.gov.co/WcfDianCustomerServices.svc</wsa:To>` +
        `</soap:Header>` +
        `<soap:Body>` +
          `<wcf:GetStatus>` +
            `<wcf:trackId>${trackId}</wcf:trackId>` +
          `</wcf:GetStatus>` +
        `</soap:Body>` +
      `</soap:Envelope>`;

    return { xml: soapEnvelope.trim(), toId: toId, timestampId: timestampId, signatureId: signatureId, keyInfoId: keyInfoId, strId: strId };
  }

    /**
   * Función auxiliar para firmar el XML con orden estricto y firma de <To>
   */ 
    signXml(xmlData, privateKeyPem, thumbprint) {
    const { xml, toId, timestampId, signatureId, keyInfoId, strId } = xmlData;
    
    // Importaciones locales para asegurar que usamos las correctas
    const DOMParser = require('xmldom').DOMParser;
    const XMLSerializer = require('xmldom').XMLSerializer;
    const { SignedXml } = require('xml-crypto');

    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    
    // Verificación crítica de parseo
    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Error de parseo XML: El XML generado no es válido.");
    }
    if (!doc.documentElement) {
      throw new Error("Error de parseo XML: No hay elemento raíz.");
    }

    const signature = new SignedXml();
    
    // Configuración Global de Algoritmos
    signature.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    signature.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
    
    // Definición EXPLÍCITA del algoritmo de digest como string constante
    const DIGEST_ALGORITHM = "http://www.w3.org/2001/04/xmlenc#sha256";
    
    // Definición EXPLÍCITA de transforms como array SIMPLE de strings
    // NO usar objetos aquí. Solo el URI del algoritmo de canonicalización.
    const TRANSFORMS = ["http://www.w3.org/2001/10/xml-exc-c14n#"];

    try {
      // --- REFERENCIA 1: El Tag <To> (CRÍTICO) ---
      // Usando sintaxis de xml-crypto v6+
      const toUri = `#${toId}`;
      
      console.log(`[DEBUG] Firmando referencia: ${toUri} con digest: ${DIGEST_ALGORITHM}`);

      signature.addReference({
        xpath: `//*[@*[local-name(.)='Id' and .='${toId}']]`,
        uri: toUri,
        transforms: TRANSFORMS,
        digestAlgorithm: DIGEST_ALGORITHM,
        inclusiveNamespacesPrefixList: ["wsa", "soap", "wcf"]
      });

      // --- REFERENCIA 2: Timestamp (Opcional pero recomendado) ---
      // Comentado para igualar el comportamiento de SOAP UI donde no se firma el timestamp
      /*signature.addReference({
        xpath: `//*[@*[local-name(.)='Id' and .='${timestampId}']]`, 
        uri: `#${timestampId}`,
        transforms: TRANSFORMS, 
        digestAlgorithm: DIGEST_ALGORITHM
      });*/

      // Asignar Clave Privada (en xml-crypto v6 se usa privateKey en lugar de signingKey)
      signature.privateKey = privateKeyPem;
      signature.inclusiveNamespacesPrefixList = ["wsa", "soap", "wcf"];

      // KeyInfo Content para xml-crypto v6
      signature.keyInfoAttributes = { Id: keyInfoId };
      signature.getKeyInfoContent = function() {
          return `<wsse:SecurityTokenReference wsu:Id="${strId}">` +
                 `<wsse:Reference URI="#X509-${thumbprint}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>` +
                 `</wsse:SecurityTokenReference>`;
      };

      // Calcular Firma usando el string XML, no el objeto doc
      signature.computeSignature(xml, {
        location: {
          reference: "//*[local-name(.)='Security']",
          action: "append"
        },
        prefix: "ds" // Opcional: para forzar el prefijo ds: en los elementos Signature (aunque xml-crypto a veces usa el root o ninguno, ds es estándar)
      });
      
      // En xml-crypto v6, getSignedXml() devuelve el documento completo con la firma inyectada
      let signedXmlStr = signature.getSignedXml();
      
      // Ajustar manualmente el Id de Signature si es necesario (xml-crypto 6 lo agrega si se configura, pero aquí lo reemplazamos rápido)
      signedXmlStr = signedXmlStr.replace('<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">', `<ds:Signature Id="${signatureId}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`);
      signedXmlStr = signedXmlStr.replace('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">', `<Signature Id="${signatureId}" xmlns="http://www.w3.org/2000/09/xmldsig#">`);

      return signedXmlStr;

    } catch (err) {
      console.error("Fallo CRÍTICO en signXml:", err.message);
      console.error("Stack:", err.stack);
      // Imprimir versión de xml-crypto para depuración futura
      try {
        const pkg = require('xml-crypto/package.json');
        console.error(`Versión de xml-crypto: ${pkg.version}`);
      } catch(e) {}
      throw err;
    }
  }

  sendRawSoap(xml, operation) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const parsedUrl = new URL(this.endpoint);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml;charset=UTF-8;action="http://wcf.dian.colombia/IWcfDianCustomerServices/${operation}"`,
          'Content-Length': Buffer.byteLength(xml)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.write(xml);
      req.end();
    });
  }

  parseDianResponse(xmlString) {
    // Parser básico para extraer información de DianResponse
    // En producción usar un parser XML más robusto
    const dom = new DOMParser().parseFromString(xmlString, 'text/xml');
    
    // Buscar nodos de respuesta (ajustar según estructura real de respuesta GetStatus)
    const isValidNode = dom.getElementsByTagNameNS("*", "IsValid")[0];
    const statusCodeNode = dom.getElementsByTagNameNS("*", "StatusCode")[0];
    const statusDescNode = dom.getElementsByTagNameNS("*", "StatusDescription")[0];
    const errorMessageNode = dom.getElementsByTagNameNS("*", "ErrorMessage")[0];

    return {
      isValid: isValidNode ? isValidNode.textContent === 'true' : false,
      statusCode: statusCodeNode ? statusCodeNode.textContent : null,
      statusDescription: statusDescNode ? statusDescNode.textContent : null,
      errorMessage: errorMessageNode ? errorMessageNode.textContent : null,
      rawResponse: xmlString
    };
  }

  parseResolutionsResponse(xmlString) {
    const dom = new DOMParser().parseFromString(xmlString, 'text/xml');
    const resolutions = [];
    
    // Buscar NumberRangeResponse nodes
    const items = dom.getElementsByTagNameNS("*", "NumberRangeResponse");
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const getNodeVal = (tag) => {
        const nodes = item.getElementsByTagNameNS("*", tag);
        return nodes.length > 0 ? nodes[0].textContent : null;
      };

      resolutions.push({
        ResolutionNumber: getNodeVal("ResolutionNumber"),
        ResolutionDate: getNodeVal("ResolutionDate"),
        Prefix: getNodeVal("Prefix"),
        FromNumber: getNodeVal("FromNumber"),
        ToNumber: getNodeVal("ToNumber"),
        ValidDateFrom: getNodeVal("ValidDateFrom"),
        ValidDateTo: getNodeVal("ValidDateTo"),
        TechnicalKey: getNodeVal("TechnicalKey")
      });
    }

    return { resolutions };
  }

  async persistDocumentData(data, tipo, nit, trackId, t) {
    // Buscar si ya existe el documento por trackId o crearlo
    const [doc, created] = await Documento.findOrCreate({
      where: { trackId: trackId },
      defaults: {
        tipoDocumento: tipo,
        terceroNit: nit,
        trackId: trackId,
        estadoDian: 'PENDIENTE'
      },
      transaction: t
    });

    // Actualizar campos con la respuesta
    doc.estadoDian = data.isValid ? 'ACEPTADA' : 'RECHAZADA';
    doc.mensajeDian = data.statusDescription || data.errorMessage;
    doc.fechaUltimaActualizacion = new Date();
    
    await doc.save({ transaction: t });

    // Actualizar tercero
    await Tercero.upsert({
      nit: nit,
      fechaUltimaConsulta: new Date()
    }, { transaction: t });
  }

  calcularEstado(fechaFinStr) {
    if (!fechaFinStr) return 'DESCONOCIDO';
    const fechaFin = new Date(fechaFinStr);
    const hoy = new Date();
    return hoy <= fechaFin ? 'VIGENTE' : 'VENCIDA';
  }
}

// Exportar UNA SOLA INSTANCIA
module.exports = new DianService();