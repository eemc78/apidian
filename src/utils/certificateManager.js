const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge'); // Necesitas instalar: npm install node-forge

class CertificateManager {
  constructor(certPath, certFilename, password) {
    this.certPath = path.resolve(__dirname, '../../', certPath);
    this.filename = certFilename;
    this.password = password;
    this.p12Buffer = null;
    this.pkey = null;
    this.cert = null;
  }

  async load() {
    const filePath = path.join(this.certPath, this.filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Certificado no encontrado en: ${filePath}`);
    }

    try {
      const p12Der = fs.readFileSync(filePath);
      const p12Asn1 = forge.asn1.fromDer(p12Der.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.password);

      // Extraer clave privada y certificado
      const bags = p12.getBags({ bagType: forge.pki.oids.keyBag });
      const keyBag = bags[forge.pki.oids.keyBag][0];
      
      this.pkey = keyBag.key; // Private Key
      this.cert = p12.getCertificates()[0]; // Public Cert
      
      return { privateKey: this.pkey, certificate: this.cert };
    } catch (error) {
      throw new Error(`Error al cargar certificado: ${error.message}`);
    }
  }

  getPrivateKeyPem() {
    if (!this.pkey) throw new Error("Certificado no cargado");
    return forge.pki.privateKeyToPem(this.pkey);
  }

  getCertificatePem() {
    if (!this.cert) throw new Error("Certificado no cargado");
    return forge.pki.certificateToPem(this.cert);
  }
  
  // Función auxiliar para firmar un string (hash SHA-1 o SHA-256 según requiera DIAN)
  signData(data, algorithm = 'sha256') {
    if (!this.pkey) throw new Error("Certificado no cargado");
    const signer = crypto.createSign(algorithm);
    signer.update(data);
    return signer.sign(this.getPrivateKeyPem(), 'base64');
  }
}

module.exports = CertificateManager;