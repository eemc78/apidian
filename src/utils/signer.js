const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const logger = require('./logger');

class DianSigner {
  constructor(certPath, certFilename, password) {
    this.password = password;
    this.privateKeyPem = null;
    this.publicCertPem = null;
    this.thumbprint = null;

    // Resolver ruta absoluta
    const baseDir = process.cwd();
    const fullPath = path.resolve(baseDir, certPath, certFilename);

    logger.info(`🔍 Buscando certificado en: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      logger.error(`❌ ARCHIVO NO ENCONTRADO: ${fullPath}`);
      throw new Error(`Certificado no encontrado. Verifica la ruta: ${fullPath}`);
    }

    try {
      // LEER COMO BUFFER BINARIO PURO (Crucial en Windows)
      // No usar 'utf8' ni otras codificaciones de texto
      const p12Buffer = fs.readFileSync(fullPath);
      
      // Convertir buffer a string binario para forge
      const p12Der = p12Buffer.toString('binary');
      const p12Asn1 = forge.asn1.fromDer(p12Der);

      logger.info('🔓 Intentando desencriptar PKCS#12...');

      let p12;
      try {
        // Intento 1: Estándar
        p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, this.password);
      } catch (e1) {
        logger.warn('Intento 1 falló, probando modo estricto...');
        try {
          // Intento 2: Sin el flag 'false' (algunos certs lo requieren)
          p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.password);
        } catch (e2) {
          throw new Error(`Error al parsear PKCS#12: ${e2.message}. Verifica la contraseña.`);
        }
      }

      // --- EXTRACCIÓN MANUAL DE CLAVE PRIVADA ---
      // No confiamos en métodos helper que pueden fallar, recorremos las bolsas manualmente
      
      // Función auxiliar para buscar bolsas recursivamente si están anidadas
      const findBagsByType = (p12Obj, typeOid) => {
        const bags = p12Obj.getBags({ bagType: typeOid });
        if (bags[typeOid] && bags[typeOid].length > 0) {
          return bags[typeOid];
        }
        return [];
      };

      // 1. Buscar Clave Privada
      // Primero intentamos con KeyBag estándar
      let keyBags = findBagsByType(p12, forge.pki.oids.keyBag);
      
      // Si no hay, buscamos en PKCS8ShroudedKeyBag (muy común en certificados DIAN/Windows)
      if (keyBags.length === 0) {
        logger.info('No se encontró KeyBag estándar, buscando PKCS8ShroudedKeyBag...');
        const pkcs8Bags = findBagsByType(p12, forge.pki.oids.pkcs8ShroudedKeyBag);
        
        if (pkcs8Bags.length > 0) {
          // La clave ya viene desencriptada por el paso anterior (pkcs12FromAsn1)
          const keyObj = pkcs8Bags[0].key;
          this.privateKeyPem = forge.pki.privateKeyToPem(keyObj);
          logger.info('✅ Clave privada extraída de PKCS8ShroudedKeyBag.');
        } else {
          throw new Error("No se encontró ninguna clave privada en el archivo .p12");
        }
      } else {
        const keyObj = keyBags[0].key;
        this.privateKeyPem = forge.pki.privateKeyToPem(keyObj);
        logger.info('✅ Clave privada extraída de KeyBag estándar.');
      }

      // 2. Buscar Certificado Público
      // Buscamos explícitamente en CertBag
      const certBags = findBagsByType(p12, forge.pki.oids.certBag);
      
      if (certBags.length === 0) {
        throw new Error("No se encontró ningún certificado público (CertBag) en el archivo .p12");
      }

      // Tomamos el primer certificado encontrado (usualmente es el del emisor)
      const certObj = certBags[0].cert;
      this.publicCertPem = forge.pki.certificateToPem(certObj);
      
      logger.info('✅ Certificado público cargado exitosamente.');

      // 3. Calcular Thumbprint (SHA-1 del DER del certificado)
      // Necesitamos convertir el objeto cert de nuevo a ASN1 y luego a DER
      const certAsn1 = forge.pki.certificateToAsn1(certObj);
      const derBytes = forge.asn1.toDer(certAsn1).getBytes();
      
      const md = forge.md.sha1.create();
      md.update(derBytes);
      this.thumbprint = md.digest().toHex().toUpperCase();

      logger.info(`🆔 Thumbprint calculado: ${this.thumbprint}`);

    } catch (error) {
      logger.error('💥 Error crítico en el constructor del firmador:', error.message);
      
      if (error.message.includes('password') || error.message.includes('MAC')) {
        throw new Error("Contraseña incorrecta para el certificado .p12");
      }
      throw error;
    }
  }

  getPrivateKeyPem() {
    if (!this.privateKeyPem) throw new Error("Clave privada no inicializada");
    return this.privateKeyPem;
  }

  getCertificatePem() {
    if (!this.publicCertPem) throw new Error("Certificado no inicializado");
    return this.publicCertPem;
  }

  getBase64Cert() {
    if (!this.publicCertPem) throw new Error("Certificado no inicializado");
    
    // Limpiar el PEM para obtener solo el Base64
    const pemHeader = "-----BEGIN CERTIFICATE-----";
    const pemFooter = "-----END CERTIFICATE-----";
    
    return this.publicCertPem
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/[\r\n]/g, "")
      .trim();
  }
}

module.exports = DianSigner;