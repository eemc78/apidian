// models/Tercero.js
module.exports = (sequelize, DataTypes) => {
  const Tercero = sequelize.define('Tercero', {
    nit: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    dv: DataTypes.STRING,
    razonSocial: DataTypes.STRING,
    nombreComercial: DataTypes.STRING,
    naturaleza: DataTypes.ENUM('Persona Natural', 'Persona Jurídica', 'Otro'),
    regimenResponsable: DataTypes.STRING,
    direccion: DataTypes.STRING,
    ciudad: DataTypes.STRING,
    departamento: DataTypes.STRING,
    telefono: DataTypes.STRING,
    email: DataTypes.STRING,
    ultimoEstadoDian: DataTypes.STRING,
    fechaUltimaConsulta: DataTypes.DATE
  }, { tableName: 'terceros', timestamps: true });
  return Tercero;
};

