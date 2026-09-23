const express = require('express');
const router = express.Router();

const { sql, poolPromise } = require('../config/db');

const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const { requireDocumentAccess } = require('../middleware/abacMiddleware');
const { registrarAuditoria } = require('../middleware/auditMiddleware');


// =====================================================
// GET /api/documentos/:id
// CONSULTAR DOCUMENTO
// =====================================================

router.get(
  '/:id',
  authenticateToken,
  requirePermission('consultar'),
  requireDocumentAccess('consultar'),

  async (req, res) => {

    try {

      return res.json({
        mensaje: 'Documento consultado correctamente',
        tipo_control: 'RBAC + ABAC',
        usuario: req.user.nombre,
        rol: req.user.rol_nombre,
        documento: req.documento
      });

    } catch (error) {

      console.error(
        'Error consultando documento:',
        error
      );

      return res.status(500).json({
        error: 'Error consultando documento'
      });
    }
  }
);


// =====================================================
// POST /api/documentos
// CREAR DOCUMENTO
// =====================================================

router.post(
  '/',
  authenticateToken,
  requirePermission('crear'),

  async (req, res) => {

    try {

      const {
        nombre,
        departamento,
        nivel_confidencialidad,
        estado,
        pais,
        contenido_url
      } = req.body;


      // -------------------------------------------------
      // VALIDACIONES
      // -------------------------------------------------

      if (
        !nombre ||
        !departamento ||
        nivel_confidencialidad === undefined ||
        !estado ||
        !pais
      ) {

        return res.status(400).json({
          error: 'Faltan datos obligatorios'
        });
      }


      if (
        nivel_confidencialidad < 1 ||
        nivel_confidencialidad > 5
      ) {

        return res.status(400).json({
          error: 'El nivel de confidencialidad debe estar entre 1 y 5'
        });
      }


      const pool = await poolPromise;


      // -------------------------------------------------
      // INSERTAR DOCUMENTO
      // -------------------------------------------------

      const result = await pool.request()

        .input(
          'nombre',
          sql.VarChar,
          nombre
        )

        .input(
          'departamento',
          sql.VarChar,
          departamento
        )

        .input(
          'nivel_confidencialidad',
          sql.Int,
          nivel_confidencialidad
        )

        .input(
          'estado',
          sql.VarChar,
          estado
        )

        .input(
          'pais',
          sql.VarChar,
          pais
        )

        .input(
          'propietario_id',
          sql.Int,
          req.user.id
        )

        .input(
          'contenido_url',
          sql.VarChar,
          contenido_url || null
        )

        .query(`
          INSERT INTO Documento
          (
            nombre,
            departamento,
            nivel_confidencialidad,
            estado,
            pais,
            propietario_id,
            contenido_url,
            fecha_creacion
          )
          OUTPUT INSERTED.*
          VALUES
          (
            @nombre,
            @departamento,
            @nivel_confidencialidad,
            @estado,
            @pais,
            @propietario_id,
            @contenido_url,
            GETDATE()
          )
        `);


      const documento = result.recordset[0];


      // -------------------------------------------------
      // AUDITORÍA
      // -------------------------------------------------

      await registrarAuditoria({

        usuarioId: req.user.id,

        recurso: `Documento ${documento.id}`,

        accion: 'crear',

        resultado: 'PERMITIDO',

        motivo: 'Documento creado correctamente',

        ip: req.ip,

        dispositivo: req.headers['user-agent']

      });


      return res.status(201).json({

        mensaje: 'Documento creado correctamente',

        tipo_control: 'RBAC',

        documento

      });


    } catch (error) {

      console.error(
        'Error creando documento:',
        error
      );

      return res.status(500).json({
        error: 'Error creando documento'
      });
    }
  }
);


// =====================================================
// PUT /api/documentos/:id
// MODIFICAR DOCUMENTO
// =====================================================

router.put(
  '/:id',
  authenticateToken,
  requirePermission('modificar'),
  requireDocumentAccess('modificar'),

  async (req, res) => {

    try {

      const documentoActual = req.documento;


      // =================================================
      // DATOS NUEVOS
      // =================================================

      const {
        nombre,
        departamento,
        nivel_confidencialidad,
        estado,
        pais,
        contenido_url
      } = req.body;


      // =================================================
      // VALIDACIONES
      // =================================================

      if (
        !nombre ||
        !departamento ||
        nivel_confidencialidad === undefined ||
        !estado ||
        !pais
      ) {

        return res.status(400).json({
          error: 'Faltan datos obligatorios'
        });
      }


      if (
        nivel_confidencialidad < 1 ||
        nivel_confidencialidad > 5
      ) {

        return res.status(400).json({
          error: 'El nivel de confidencialidad debe estar entre 1 y 5'
        });
      }


      // =================================================
      // VALIDACIÓN ABAC DEL RECURSO RESULTANTE
      // =================================================

      // -----------------------------------------------
      // 1. ESTADO DEL USUARIO
      // -----------------------------------------------

      if (req.user.estado !== 'activo') {

        await registrarAuditoria({

          usuarioId: req.user.id,

          recurso: `Documento ${documentoActual.id}`,

          accion: 'modificar',

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


      // -----------------------------------------------
      // 2. NIVEL DE SEGURIDAD
      // -----------------------------------------------

      if (
        req.user.nivel_seguridad <
        nivel_confidencialidad
      ) {

        await registrarAuditoria({

          usuarioId: req.user.id,

          recurso: `Documento ${documentoActual.id}`,

          accion: 'modificar',

          resultado: 'DENEGADO',

          motivo: 'El nuevo nivel de confidencialidad supera el nivel de seguridad del usuario',

          ip: req.ip,

          dispositivo: req.headers['user-agent']

        });

        return res.status(403).json({

          error: 'Acceso denegado',

          motivo: 'El nuevo nivel de confidencialidad supera el nivel de seguridad del usuario',

          nivel_usuario: req.user.nivel_seguridad,

          nivel_nuevo_documento: nivel_confidencialidad

        });
      }


      // -----------------------------------------------
      // 3. DEPARTAMENTO
      // -----------------------------------------------

      if (
        req.user.departamento !==
        departamento
      ) {

        // Gerente y Administrador pueden modificar
        // documentos de otros departamentos según RBAC,
        // pero para ABAC mantenemos la política definida
        // para el recurso resultante.

        if (
          req.user.rol_nombre !== 'Gerente' &&
          req.user.rol_nombre !== 'Administrador'
        ) {

          await registrarAuditoria({

            usuarioId: req.user.id,

            recurso: `Documento ${documentoActual.id}`,

            accion: 'modificar',

            resultado: 'DENEGADO',

            motivo: 'El nuevo departamento no coincide con el departamento del usuario',

            ip: req.ip,

            dispositivo: req.headers['user-agent']

          });

          return res.status(403).json({

            error: 'Acceso denegado',

            motivo: 'El nuevo departamento no coincide con el departamento del usuario',

            departamento_usuario: req.user.departamento,

            departamento_nuevo_documento: departamento

          });
        }
      }


      // -----------------------------------------------
      // 4. PAÍS
      // -----------------------------------------------

      if (
        req.user.pais !==
        pais
      ) {

        await registrarAuditoria({

          usuarioId: req.user.id,

          recurso: `Documento ${documentoActual.id}`,

          accion: 'modificar',

          resultado: 'DENEGADO',

          motivo: 'El nuevo país no coincide con el país del usuario',

          ip: req.ip,

          dispositivo: req.headers['user-agent']

        });

        return res.status(403).json({

          error: 'Acceso denegado',

          motivo: 'El nuevo país no coincide con el país del usuario',

          pais_usuario: req.user.pais,

          pais_nuevo_documento: pais

        });
      }


      // -----------------------------------------------
      // 5. HORARIO
      // -----------------------------------------------

      if (nivel_confidencialidad >= 4) {

        const horaLima = new Intl.DateTimeFormat(

          'es-PE',

          {
            timeZone: 'America/Lima',
            hour: '2-digit',
            hour12: false
          }

        ).format(new Date());


        const horaActual = parseInt(
          horaLima,
          10
        );


        if (
          horaActual < 8 ||
          horaActual >= 18
        ) {

          await registrarAuditoria({

            usuarioId: req.user.id,

            recurso: `Documento ${documentoActual.id}`,

            accion: 'modificar',

            resultado: 'DENEGADO',

            motivo: 'El nuevo documento tiene alta confidencialidad y el acceso está fuera del horario permitido',

            ip: req.ip,

            dispositivo: req.headers['user-agent']

          });

          return res.status(403).json({

            error: 'Acceso denegado',

            motivo: 'Los documentos de alta confidencialidad solo pueden modificarse entre 08:00 y 18:00',

            horario_permitido: '08:00 - 18:00',

            hora_actual: `${horaActual}:00`,

            zona_horaria: 'America/Lima'

          });
        }
      }


      // -----------------------------------------------
      // 6. DISPOSITIVO
      // -----------------------------------------------

      if (nivel_confidencialidad >= 4) {

        const tipoDispositivo =
          req.headers['x-device-type'];


        if (
          tipoDispositivo !== 'corporate'
        ) {

          await registrarAuditoria({

            usuarioId: req.user.id,

            recurso: `Documento ${documentoActual.id}`,

            accion: 'modificar',

            resultado: 'DENEGADO',

            motivo: 'El nuevo documento requiere dispositivo corporativo',

            ip: req.ip,

            dispositivo: req.headers['user-agent']

          });

          return res.status(403).json({

            error: 'Acceso denegado',

            motivo: 'Los documentos de alta confidencialidad requieren un dispositivo corporativo',

            dispositivo_requerido: 'corporate',

            dispositivo_actual:
              tipoDispositivo || 'no identificado'

          });
        }
      }


      // =================================================
      // ACTUALIZAR DOCUMENTO
      // =================================================

      const pool = await poolPromise;


      const result = await pool.request()

        .input(
          'id',
          sql.Int,
          documentoActual.id
        )

        .input(
          'nombre',
          sql.VarChar,
          nombre
        )

        .input(
          'departamento',
          sql.VarChar,
          departamento
        )

        .input(
          'nivel_confidencialidad',
          sql.Int,
          nivel_confidencialidad
        )

        .input(
          'estado',
          sql.VarChar,
          estado
        )

        .input(
          'pais',
          sql.VarChar,
          pais
        )

        .input(
          'contenido_url',
          sql.VarChar,
          contenido_url || null
        )

        .query(`
          UPDATE Documento

          SET
            nombre = @nombre,
            departamento = @departamento,
            nivel_confidencialidad = @nivel_confidencialidad,
            estado = @estado,
            pais = @pais,
            contenido_url = @contenido_url

          OUTPUT INSERTED.*

          WHERE id = @id
        `);


      const documentoActualizado =
        result.recordset[0];


      // =================================================
      // AUDITORÍA
      // =================================================

      await registrarAuditoria({

        usuarioId: req.user.id,

        recurso:
          `Documento ${documentoActualizado.id}`,

        accion: 'modificar',

        resultado: 'PERMITIDO',

        motivo:
          'Documento modificado correctamente',

        ip: req.ip,

        dispositivo:
          req.headers['user-agent']

      });


      return res.json({

        mensaje:
          'Documento modificado correctamente',

        tipo_control:
          'RBAC + ABAC',

        documento:
          documentoActualizado

      });


    } catch (error) {

      console.error(
        'Error modificando documento:',
        error
      );

      return res.status(500).json({
        error: 'Error modificando documento'
      });
    }
  }
);


// =====================================================
// DELETE /api/documentos/:id
// ELIMINAR DOCUMENTO
// =====================================================

router.delete(
  '/:id',
  authenticateToken,
  requirePermission('eliminar'),
  requireDocumentAccess('eliminar'),

  async (req, res) => {

    try {

      const documento = req.documento;

      const pool = await poolPromise;


      await pool.request()

        .input(
          'id',
          sql.Int,
          documento.id
        )

        .query(`
          DELETE FROM Documento
          WHERE id = @id
        `);


      await registrarAuditoria({

        usuarioId: req.user.id,

        recurso:
          `Documento ${documento.id}`,

        accion: 'eliminar',

        resultado: 'PERMITIDO',

        motivo:
          'Documento eliminado correctamente',

        ip: req.ip,

        dispositivo:
          req.headers['user-agent']

      });


      return res.json({

        mensaje:
          'Documento eliminado correctamente',

        tipo_control:
          'RBAC + ABAC',

        documento_id:
          documento.id

      });


    } catch (error) {

      console.error(
        'Error eliminando documento:',
        error
      );

      return res.status(500).json({
        error: 'Error eliminando documento'
      });
    }
  }
);


// =====================================================
// PUT /api/documentos/:id/aprobar
// APROBAR DOCUMENTO
// =====================================================

router.put(
  '/:id/aprobar',
  authenticateToken,
  requirePermission('aprobar'),
  requireDocumentAccess('aprobar'),

  async (req, res) => {

    try {

      const documento = req.documento;

      const pool = await poolPromise;


      const result = await pool.request()

        .input(
          'id',
          sql.Int,
          documento.id
        )

        .query(`
          UPDATE Documento

          SET estado = 'APROBADO'

          OUTPUT INSERTED.*

          WHERE id = @id
        `);


      const documentoAprobado =
        result.recordset[0];


      await registrarAuditoria({

        usuarioId: req.user.id,

        recurso:
          `Documento ${documento.id}`,

        accion: 'aprobar',

        resultado: 'PERMITIDO',

        motivo:
          'Documento aprobado correctamente',

        ip: req.ip,

        dispositivo:
          req.headers['user-agent']

      });


      return res.json({

        mensaje:
          'Documento aprobado correctamente',

        tipo_control:
          'RBAC + ABAC',

        documento:
          documentoAprobado

      });


    } catch (error) {

      console.error(
        'Error aprobando documento:',
        error
      );

      return res.status(500).json({
        error: 'Error aprobando documento'
      });
    }
  }
);


module.exports = router;