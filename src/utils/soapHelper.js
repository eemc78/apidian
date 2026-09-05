const DOMParser = require('xmldom').DOMParser;
const XMLSerializer = require('xmldom').XMLSerializer;

const soapHelper = {
  parseXml: (xmlString) => {
    try {
      return new DOMParser().parseFromString(xmlString, 'text/xml');
    } catch (e) {
      throw new Error("Error al parsear XML");
    }
  },

  serializeXml: (doc) => {
    return new XMLSerializer().serializeToString(doc);
  },

  extractSoapBodyContent: (soapResponse) => {
    const doc = soapHelper.parseXml(soapResponse);
    const body = doc.getElementsByTagNameNS("*", "Body")[0];
    if (!body) return null;
    return soapHelper.serializeXml(body);
  },

  getNamespacePrefix: (doc, uri) => {
    // Utilidad simple para encontrar prefijos de namespace si es necesario
    for (let i = 0; i < doc.documentElement.attributes.length; i++) {
      const attr = doc.documentElement.attributes[i];
      if (attr.value === uri && attr.name.startsWith('xmlns:')) {
        return attr.name.split(':')[1];
      }
    }
    return '';
  }
};

module.exports = soapHelper;