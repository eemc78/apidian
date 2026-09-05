// models/Documento.js
module.exports = (sequelize, DataTypes) => {
  const Documento = sequelize.define('Documento', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tipoDocumento: DataTypes.STRING, // FACTURA, NOTA_CREDITO, etc.
    numero: DataTypes.STRING,
    prefijo: DataTypes.STRING,
    cufe: { type: DataTypes.STRING, unique: true, allowNull: true },
    cud: { type: DataTypes.STRING, unique: true, allowNull: true },
    fechaEmision: DataTypes.DATE,
    valorTotal: DataTypes.DECIMAL(15, 2),
    estadoDian: DataTypes.ENUM('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'NO_ENCONTRADA', 'EN_PROCESO'),
    mensajeDian: DataTypes.TEXT,
    trackId: DataTypes.STRING, // Para consultas asíncronas
    xmlRespuesta: DataTypes.TEXT, // Almacenamiento opcional del XML crudo
    terceroNit: { 
      type: DataTypes.STRING, 
      references: { model: 'terceros', key: 'nit' },
      allowNull: false 
    },
    fechaUltimaActualizacion: DataTypes.DATE
  }, { tableName: 'documentos', timestamps: true });
  return Documento;
};