const soap = require('soap');
const DianSigner = require('../utils/dianSigner');
const { Resolucion, Tercero } = require('../models');
const logger = require('../utils/logger');
const sequelize = require('../config/database');

class DianService {
  constructor() {
    if (!process.env.CERT_PATH || !process.env.CERT_FILENAME) {
      throw new Error("Configuración de certificados faltante en .env");
    }
    const certPath = `${process.env.CERT_PATH}/${process.env.CERT_FILENAME}`;
    this.signer = new DianSigner(certPath, process.env.CERT_PASSWORD);
    this.endpoint = "https://vpfe.dian.gov.co/WcfDianCustomerServices.svc";
  }

  async consultarResoluciones(nit, softwareCode) {
    const transaction = await sequelize.transaction();
    try {
      // 1. Generar XML Firmado
      const signedSoapXml = this.signer.createSignedRequest(nit, nit, softwareCode);

      // 2. Enviar petición HTTP POST manual (node-soap a veces lucha con headers personalizados de WS-Security complejos)
      const result = await this.sendRawSoap(signedSoapXml);

      // 3. Parsear Respuesta
      const data = this.parseNumberingRangeResponse(result);

      // 4. Guardar en DB
      if (data && data.resolutions && data.resolutions.length > 0) {
        for (const res of data.resolutions) {
          await Resolucion.upsert({
            numeroResolucion: res.ResolutionNumber,
            fechaExpedicion: res.ResolutionDate,
            prefijo: res.Prefix,
            desde: res.FromNumber,
            hasta: res.ToNumber,
            estado: this.calcularEstado(res.ValidDateTo),
            fechaUltimaActualizacion: new Date()
          }, { transaction });
        }
        
        // Actualizar datos básicos del tercero si vienen en la respuesta o asumirlos
        await Tercero.upsert({
          nit: nit,
          fechaUltimaConsulta: new Date()
        }, { transaction });
      }

      await transaction.commit();
      return { success: true, data };

    } catch (error) {
      await transaction.rollback();
      logger.error("Error consultando resoluciones DIAN", error);
      throw {
        statusCode: 500,
        message: "Error de comunicación con la DIAN",
        details: error.message
      };
    }
  }

  sendRawSoap(xml) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const parsedUrl = new URL(this.endpoint);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8', // SOAP 1.2 requiere este content-type
          'SOAPAction': '"http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRange"',
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
            reject(new Error(`HTTP Error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.write(xml);
      req.end();
    });
  }

  parseNumberingRangeResponse(xmlString) {
    // Parsing simple usando regex o xmldom para extraer los nodos NumberRangeResponse
    // En producción usaría un parser XML robusto, aquí simplificado para el ejemplo
    const dom = new (require('xmldom').DOMParser)().parseFromString(xmlString, 'text/xml');
    
    // Buscar nodos de respuesta (ajustar namespaces según respuesta real)
    // La respuesta viene envuelta en GetNumberingRangeResponse -> GetNumberingRangeResult -> ResponseList -> ArrayOfNumberRangeResponse
    // Dado que los namespaces son complejos, buscaremos por nombre local
    
    const resolutions = [];
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
        FromNumber: parseInt(getNodeVal("FromNumber") || 0),
        ToNumber: parseInt(getNodeVal("ToNumber") || 0),
        ValidDateFrom: getNodeVal("ValidDateFrom"),
        ValidDateTo: getNodeVal("ValidDateTo"),
        TechnicalKey: getNodeVal("TechnicalKey")
      });
    }

    return { resolutions };
  }

  calcularEstado(fechaFinStr) {
    if (!fechaFinStr) return 'DESCONOCIDO';
    const fechaFin = new Date(fechaFinStr);
    const hoy = new Date();
    return hoy <= fechaFin ? 'VIGENTE' : 'VENCIDA';
  }
}

module.exports = new DianService();