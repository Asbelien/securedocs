const { sql, poolPromise } = require('../config/db');
const { registrarAuditoria } = require('./auditMiddleware');

function requireDocumentAccess(accion = 'consultar') {

  return async (req, res, next) => {

    try {

      if (!req.user) {
        return res.status(401).json({
          error: 'Usuario no autenticado'
        });
      }

      const documentoId = parseInt(req.params.id);

      if (isNaN(documentoId)) {
        return res.status(400).json({
          error: 'ID de documento inválido'
        });
      }

      const pool = await poolPromise;

      const result = await pool.request()
        .input('documento_id', sql.Int, documentoId)
        .query(`
          SELECT
            id,
            nombre,
            departamento,
            nivel_confidencialidad,
            estado,
            pais,
            propietario_id
          FROM Documento
          WHERE id = @documento_id
        `);

      const documento = result.recordset[0];

      if (!documento) {
        return res.status(404).json({
          error: 'Documento no encontrado'
        });
      }

      const recurso = `Documento ${documento.id}`;

      // ABAC 1 — estado del usuario
      if (req.user.estado !== 'activo') {

        await registrarAuditoria({
          usuarioId: req.user.id,
          recurso,
          accion,
          resultado: 'DENEGADO',
          motivo: 'Usuario inactivo',
          ip: req.ip,
          dispositivo: req.headers['user-agent']
        });

        return res.status(403).json({
          error: 'Acceso denegado',
          motivo: 'Usuario inactivo'
        });
      }

      // ABAC 2 — política especial para invitados
      if (req.user.rol_nombre === 'Invitado') {

        if (req.user.tipo_contrato !== 'EXTERNO') {

          await registrarAuditoria({
            usuarioId: req.user.id,
            recurso,
            accion,
            resultado: 'DENEGADO',
            motivo: 'El usuario invitado no tiene contrato externo',
            ip: req.ip,
            dispositivo: req.headers['user-agent']
          });

          return res.status(403).json({
            error: 'Acceso denegado',
            motivo: 'El usuario invitado requiere tipo de contrato EXTERNO'
          });
        }

        if (documento.nivel_confidencialidad > 1) {

          await registrarAuditoria({
            usuarioId: req.user.id,
            recurso,
            accion,
            resultado: 'DENEGADO',
            motivo: 'El documento supera el nivel de confidencialidad permitido para invitados',
            ip: req.ip,
            dispositivo: req.headers['user-agent']
          });

          return res.status(403).json({
            error: 'Acceso denegado',
            motivo: 'Los invitados solamente pueden acceder a documentos con confidencialidad 1 o menor',
            nivel_documento: documento.nivel_confidencialidad
          });
        }

        if (documento.estado !== 'PUBLICADO') {

          await registrarAuditoria({
            usuarioId: req.user.id,
            recurso,
            accion,
            resultado: 'DENEGADO',
            motivo: 'El documento no está publicado',
            ip: req.ip,
            dispositivo: req.headers['user-agent']
          });

          return res.status(403).json({
            error: 'Acceso denegado',
            motivo: 'Los invitados solamente pueden acceder a documentos publicados',
            estado_documento: documento.estado
          });
        }

        await registrarAuditoria({
          usuarioId: req.user.id,
          recurso,
          accion,
          resultado: 'PERMITIDO',
          motivo: 'Invitado externo autorizado',
          ip: req.ip,
          dispositivo: req.headers['user-agent']
        });

        req.documento = documento;
        return next();
      }

      // ABAC 3 — nivel de seguridad
      if (req.user.nivel_seguridad < documento.nivel_confidencialidad) {

        await registrarAuditoria({
          usuarioId: req.user.id,
          recurso,
          accion,
          resultado: 'DENEGADO',
          motivo: 'Nivel de seguridad insuficiente',
          ip: req.ip,
          dispositivo: req.headers['user-agent']
        });

        return res.status(403).json({
          error: 'Acceso denegado',
          motivo: 'Nivel de seguridad insuficiente',
          nivel_usuario: req.user.nivel_seguridad,
          nivel_documento: documento.nivel_confidencialidad
        });
      }

      // ABAC 4 — departamento
      if (req.user.departamento !== documento.departamento) {

        await registrarAuditoria({
          usuarioId: req.user.id,
          recurso,
          accion,
          resultado: 'DENEGADO',
          motivo: 'Restricción de departamento',
          ip: req.ip,
          dispositivo: req.headers['user-agent']
        });

        return res.status(403).json({
          error: 'Acceso denegado',
          motivo: 'Restricción de departamento',
          departamento_usuario: req.user.departamento,
          departamento_documento: documento.departamento
        });
      }

      // ABAC 5 — propiedad del documento
      if (
        accion === 'modificar' &&
        req.user.rol_nombre !== 'Gerente' &&
        req.user.rol_nombre !== 'Administrador'
      ) {

        if (req.user.id !== documento.propietario_id) {

          await registrarAuditoria({
            usuarioId: req.user.id,
            recurso,
            accion,
            resultado: 'DENEGADO',
            motivo: 'El usuario no es propietario del documento',
            ip: req.ip,
            dispositivo: req.headers['user-agent']
          });

          return res.status(403).json({
            error: 'Acceso denegado',
            motivo: 'El usuario no es propietario del documento',
            usuario_id: req.user.id,
            propietario_id: documento.propietario_id
          });
        }
      }

      // ABAC 6 y 7 — horario y dispositivo
      if (documento.nivel_confidencialidad >= 4) {

        const horaLima = new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          hour12: false
        }).format(new Date());

        const horaActual = parseInt(horaLima, 10);

        if (horaActual < 8 || horaActual >= 18) {

          await registrarAuditoria({
            usuarioId: req.user.id,
            recurso,
            accion,
            resultado: 'DENEGADO',
            motivo: 'Acceso fuera del horario permitido',
            ip: req.ip,
            dispositivo: req.headers['user-agent']
          });

          return res.status(403).json({
            error: 'Acceso denegado',
            motivo: 'Los documentos de alta confidencialidad solo pueden accederse entre 08:00 y 18:00',
            horario_permitido: '08:00 - 18:00',
            hora_actual: `${horaActual}:00`,
            zona_horaria: 'America/Lima'
          });
        }

        const tipoDispositivo = req.headers['x-device-type'];

        if (tipoDispositivo !== 'corporate') {

          await registrarAuditoria({
            usuarioId: req.user.id,
            recurso,
            accion,
            resultado: 'DENEGADO',
            motivo: 'Dispositivo no corporativo',
            ip: req.ip,
            dispositivo: req.headers['user-agent']
          });

          return res.status(403).json({
            error: 'Acceso denegado',
            motivo: 'Los documentos de alta confidencialidad requieren un dispositivo corporativo',
            dispositivo_requerido: 'corporate',
            dispositivo_actual: tipoDispositivo || 'no identificado'
          });
        }
      }

      // ABAC 8 — país
      if (req.user.pais !== documento.pais) {

        await registrarAuditoria({
          usuarioId: req.user.id,
          recurso,
          accion,
          resultado: 'DENEGADO',
          motivo: 'Restricción de país',
          ip: req.ip,
          dispositivo: req.headers['user-agent']
        });

        return res.status(403).json({
          error: 'Acceso denegado',
          motivo: 'Restricción de país',
          pais_usuario: req.user.pais,
          pais_documento: documento.pais
        });
      }

      // Acceso autorizado
      await registrarAuditoria({
        usuarioId: req.user.id,
        recurso,
        accion,
        resultado: 'PERMITIDO',
        motivo: 'Acceso autorizado',
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      });

      req.documento = documento;
      next();

    } catch (error) {

      console.error(
        'Error en ABAC:',
        error
      );

      return res.status(500).json({
        error: 'Error verificando acceso al documento'
      });
    }
  };
}


// =====================================================
// VERSIÓN "PURA" DE LAS POLÍTICAS ABAC
// Reutiliza las mismas 8 reglas de arriba pero sin
// consultar la BD ni auditar por documento individual.
// Sirve para filtrar listados completos en memoria
// (GET /documentos) sin generar un registro de
// auditoría por cada fila.
// =====================================================

function usuarioPuedeAcceder(user, documento, opciones = {}) {

  const { accion = 'consultar', deviceType } = opciones;

  if (user.estado !== 'activo') {
    return false;
  }

  if (user.rol_nombre === 'Invitado') {
    if (user.tipo_contrato !== 'EXTERNO') return false;
    if (documento.nivel_confidencialidad > 1) return false;
    if (documento.estado !== 'PUBLICADO') return false;
    return true;
  }

  if (user.nivel_seguridad < documento.nivel_confidencialidad) {
    return false;
  }

  if (user.departamento !== documento.departamento) {
    return false;
  }

  if (
    accion === 'modificar' &&
    user.rol_nombre !== 'Gerente' &&
    user.rol_nombre !== 'Administrador' &&
    user.id !== documento.propietario_id
  ) {
    return false;
  }

  if (documento.nivel_confidencialidad >= 4) {

    const horaLima = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      hour12: false
    }).format(new Date());

    const horaActual = parseInt(horaLima, 10);

    if (horaActual < 8 || horaActual >= 18) return false;
    if (deviceType !== 'corporate') return false;
  }

  if (user.pais !== documento.pais) {
    return false;
  }

  return true;
}


module.exports = {
  requireDocumentAccess,
  usuarioPuedeAcceder
};