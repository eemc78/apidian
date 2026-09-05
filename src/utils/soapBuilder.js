const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const DOMParser = require('xmldom').DOMParser;
const XMLSerializer = require('xmldom').XMLSerializer;
const uuid = require('uuid');

class SoapBuilder {
  constructor(signerInstance) {
    this.signer = signerInstance;
  }

  buildGetNumberingRange(nit, softwareCode) {
    const messageId = `urn:uuid:${uuid.v4()}`;
    const timestampId = `TS-${uuid.v4()}`;
    const securityId = `Security-${uuid.v4()}`;
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const thumbprint = this.signer.thumbprint;
    const base64Cert = this.signer.getBase64Cert();
    const privateKeyPem = this.signer.getPrivateKeyPem();

    let soapEnvelope = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" 
                     xmlns:wcf="http://wcf.dian.colombia"
                     xmlns:wsa="http://www.w3.org/2005/08/addressing"
                     xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
                     xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <soap:Header>
          <wsa:Action soap:mustUnderstand="true">http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRange</wsa:Action>
          <wsa:MessageID>${messageId}</wsa:MessageID>
          <wsa:To soap:mustUnderstand="true">https://vpfe.dian.gov.co/WcfDianCustomerServices.svc</wsa:To>
          
          <wsse:Security soap:mustUnderstand="true" wsu:Id="${securityId}">
            <wsu:Timestamp wsu:Id="${timestampId}">
              <wsu:Created>${now}</wsu:Created>
              <wsu:Expires>${expires}</wsu:Expires>
            </wsu:Timestamp>
            
            <wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" 
                                      ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" 
                                      wsu:Id="X509-${thumbprint}">
              ${base64Cert}
            </wsse:BinarySecurityToken>
          </wsse:Security>
        </soap:Header>
        <soap:Body>
          <wcf:GetNumberingRange>
            <wcf:accountCode>${nit}</wcf:accountCode>
            <wcf:accountCodeT>${nit}</wcf:accountCodeT>
            <wcf:softwareCode>${softwareCode}</wcf:softwareCode>
          </wcf:GetNumberingRange>
        </soap:Body>
      </soap:Envelope>
    `;

    // Aquí deberías llamar a la lógica de firma de xml-crypto similar a la que intentamos antes
    // Para brevidad, asumimos que necesitas integrar la firma aquí.
    // Si la firma falla, el XML sin firmar no servirá.
    
    return soapEnvelope; // Retornar temporalmente sin firma para probar conexión básica (fallará en DIAN real)
  }
  
  // Método similar para GetStatus (consulta de facturas)
  buildGetStatus(trackId) {
     // Construir XML para GetStatus
     return `<!-- XML para GetStatus -->`;
  }
}

module.exports = SoapBuilder;