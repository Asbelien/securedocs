const { sql, poolPromise } = require('../config/db');

async function registrarAuditoria({
  usuarioId,
  recurso,
  accion,
  resultado,
  motivo,
  ip,
  dispositivo
}) {
  try {

    const pool = await poolPromise;

    await pool.request()
      .input('usuario_id', sql.Int, usuarioId)
      .input('recurso', sql.VarChar, recurso)
      .input('accion', sql.VarChar, accion)
      .input('resultado', sql.VarChar, resultado)
      .input('motivo', sql.VarChar, motivo || null)
      .input('ip', sql.VarChar, ip || null)
      .input('dispositivo', sql.VarChar, dispositivo || null)
      .query(`
        INSERT INTO Auditoria
        (
          usuario_id,
          recurso,
          accion,
          resultado,
          motivo,
          ip,
          dispositivo,
          fecha
        )
        VALUES
        (
          @usuario_id,
          @recurso,
          @accion,
          @resultado,
          @motivo,
          @ip,
          @dispositivo,
          GETDATE()
        )
      `);

  } catch (error) {

    console.error('Error registrando auditoría:', error);

  }
}

module.exports = {
  registrarAuditoria
};