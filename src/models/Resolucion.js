
// models/Resolucion.js
module.exports = (sequelize, DataTypes) => {
  const Resolucion = sequelize.define('Resolucion', {
    numeroResolucion: { type: DataTypes.STRING, primaryKey: true },
    fechaExpedicion: DataTypes.DATE,
    fechaInicio: DataTypes.DATE,
    fechaFin: DataTypes.DATE,
    prefijo: DataTypes.STRING,
    desde: DataTypes.BIGINT,
    hasta: DataTypes.BIGINT,
    estado: DataTypes.ENUM('VIGENTE', 'VENCIDA', 'REVOCADA', 'SUSPENDIDA'),
    technicalKey: DataTypes.STRING, // Clave técnica devuelta por DIAN
    tipoOperacion: DataTypes.STRING,
    fechaUltimaActualizacion: DataTypes.DATE
  }, { tableName: 'resoluciones', timestamps: true });
  return Resolucion;
};
