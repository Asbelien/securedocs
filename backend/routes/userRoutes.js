const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');

const { sql, poolPromise } = require('../config/db');

const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const { registrarAuditoria } = require('../middleware/auditMiddleware');


// =====================================================
// LISTAR USUARIOS
// RBAC: gestionar_usuarios
// =====================================================

router.get(
  '/',
  authenticateToken,
  requirePermission('gestionar_usuarios'),
  async (req, res) => {

    try {

      const pool = await poolPromise;

      const result = await pool.request()
        .query(`
          SELECT
            u.id,
            u.nombre,
            u.email,
            r.nombre AS rol,
            u.departamento,
            u.nivel_seguridad,
            u.pais,
            u.tipo_contrato,
            u.estado
          FROM Usuario u
          INNER JOIN Rol r
            ON u.rol_id = r.id
          ORDER BY u.id
        `);

      return res.json({
        mensaje: 'Usuarios consultados correctamente',
        tipo_control: 'RBAC',
        usuario: req.user.nombre,
        rol: req.user.rol_nombre,
        total: result.recordset.length,
        usuarios: result.recordset
      });

    } catch (error) {

      console.error('Error consultando usuarios:', error);

      return res.status(500).json({
        error: 'Error consultando usuarios'
      });

    }

  }
);


// =====================================================
// CREAR USUARIO
// RBAC: gestionar_usuarios
// =====================================================

router.post(
  '/',
  authenticateToken,
  requirePermission('gestionar_usuarios'),
  async (req, res) => {

    try {

      const {
        nombre,
        email,
        password,
        rol_id,
        departamento,
        nivel_seguridad,
        pais,
        tipo_contrato,
        estado
      } = req.body;


      // -------------------------------------------------
      // VALIDAR CAMPOS OBLIGATORIOS
      // -------------------------------------------------

      if (
        !nombre ||
        !email ||
        !password ||
        rol_id === undefined ||
        !departamento ||
        nivel_seguridad === undefined ||
        !pais ||
        !tipo_contrato
      ) {

        return res.status(400).json({
          error: 'Faltan campos obligatorios'
        });

      }


      // -------------------------------------------------
      // VALIDAR NIVEL DE SEGURIDAD
      // -------------------------------------------------

      if (
        !Number.isInteger(Number(nivel_seguridad)) ||
        Number(nivel_seguridad) < 1 ||
        Number(nivel_seguridad) > 5
      ) {

        return res.status(400).json({
          error: 'nivel_seguridad debe ser un número entre 1 y 5'
        });

      }


      // -------------------------------------------------
      // VALIDAR ROL
      // -------------------------------------------------

      const pool = await poolPromise;

      const rolResult = await pool.request()
        .input('rol_id', sql.Int, Number(rol_id))
        .query(`
          SELECT id, nombre
          FROM Rol
          WHERE id = @rol_id
        `);

      if (rolResult.recordset.length === 0) {

        return res.status(400).json({
          error: 'El rol indicado no existe'
        });

      }


      // -------------------------------------------------
      // VERIFICAR EMAIL
      // -------------------------------------------------

      const emailResult = await pool.request()
        .input('email', sql.VarChar, email)
        .query(`
          SELECT id
          FROM Usuario
          WHERE email = @email
        `);

      if (emailResult.recordset.length > 0) {

        return res.status(409).json({
          error: 'El email ya está registrado'
        });

      }


      // -------------------------------------------------
      // ENCRIPTAR PASSWORD
      // -------------------------------------------------

      const passwordHash = await bcrypt.hash(password, 10);


      // -------------------------------------------------
      // CREAR USUARIO
      // -------------------------------------------------

      const result = await pool.request()
        .input('nombre', sql.VarChar, nombre)
        .input('email', sql.VarChar, email)
        .input('password_hash', sql.VarChar, passwordHash)
        .input('rol_id', sql.Int, Number(rol_id))
        .input('departamento', sql.VarChar, departamento)
        .input(
          'nivel_seguridad',
          sql.Int,
          Number(nivel_seguridad)
        )
        .input('pais', sql.VarChar, pais)
        .input('tipo_contrato', sql.VarChar, tipo_contrato)
        .input(
          'estado',
          sql.VarChar,
          estado || 'activo'
        )
        .query(`
          INSERT INTO Usuario
          (
            nombre,
            email,
            password_hash,
            rol_id,
            departamento,
            nivel_seguridad,
            pais,
            tipo_contrato,
            estado
          )
          OUTPUT
            INSERTED.id,
            INSERTED.nombre,
            INSERTED.email,
            INSERTED.rol_id,
            INSERTED.departamento,
            INSERTED.nivel_seguridad,
            INSERTED.pais,
            INSERTED.tipo_contrato,
            INSERTED.estado
          VALUES
          (
            @nombre,
            @email,
            @password_hash,
            @rol_id,
            @departamento,
            @nivel_seguridad,
            @pais,
            @tipo_contrato,
            @estado
          )
        `);


      const usuarioCreado = result.recordset[0];


      // -------------------------------------------------
      // AUDITORÍA
      // -------------------------------------------------

      await registrarAuditoria({
        usuarioId: req.user.id,
        recurso: `Usuario ${usuarioCreado.id}`,
        accion: 'gestionar_usuarios',
        resultado: 'PERMITIDO',
        motivo: 'Usuario creado correctamente',
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      });


      return res.status(201).json({

        mensaje: 'Usuario creado correctamente',

        tipo_control: 'RBAC',

        usuario: req.user.nombre,

        rol: req.user.rol_nombre,

        nuevo_usuario: usuarioCreado

      });


    } catch (error) {

      console.error('Error creando usuario:', error);

      return res.status(500).json({
        error: 'Error creando usuario'
      });

    }

  }
);


// =====================================================
// MODIFICAR USUARIO
// RBAC: gestionar_usuarios
// =====================================================

router.put(
  '/:id',
  authenticateToken,
  requirePermission('gestionar_usuarios'),
  async (req, res) => {

    try {

      const usuarioId = parseInt(req.params.id);

      if (isNaN(usuarioId)) {

        return res.status(400).json({
          error: 'ID de usuario inválido'
        });

      }


      const {
        nombre,
        email,
        departamento,
        nivel_seguridad,
        pais,
        tipo_contrato
      } = req.body;


      // -------------------------------------------------
      // VALIDAR CAMPOS
      // -------------------------------------------------

      if (
        !nombre ||
        !email ||
        !departamento ||
        nivel_seguridad === undefined ||
        !pais ||
        !tipo_contrato
      ) {

        return res.status(400).json({
          error: 'Faltan campos obligatorios'
        });

      }


      // -------------------------------------------------
      // VALIDAR SEGURIDAD
      // -------------------------------------------------

      if (
        !Number.isInteger(Number(nivel_seguridad)) ||
        Number(nivel_seguridad) < 1 ||
        Number(nivel_seguridad) > 5
      ) {

        return res.status(400).json({
          error: 'nivel_seguridad debe ser un número entre 1 y 5'
        });

      }


      const pool = await poolPromise;


      // -------------------------------------------------
      // ACTUALIZAR USUARIO
      // -------------------------------------------------

      const result = await pool.request()
        .input('id', sql.Int, usuarioId)
        .input('nombre', sql.VarChar, nombre)
        .input('email', sql.VarChar, email)
        .input('departamento', sql.VarChar, departamento)
        .input(
          'nivel_seguridad',
          sql.Int,
          Number(nivel_seguridad)
        )
        .input('pais', sql.VarChar, pais)
        .input('tipo_contrato', sql.VarChar, tipo_contrato)
        .query(`
          UPDATE Usuario
          SET
            nombre = @nombre,
            email = @email,
            departamento = @departamento,
            nivel_seguridad = @nivel_seguridad,
            pais = @pais,
            tipo_contrato = @tipo_contrato
          OUTPUT
            INSERTED.id,
            INSERTED.nombre,
            INSERTED.email,
            INSERTED.rol_id,
            INSERTED.departamento,
            INSERTED.nivel_seguridad,
            INSERTED.pais,
            INSERTED.tipo_contrato,
            INSERTED.estado
          WHERE id = @id
        `);


      const usuarioActualizado = result.recordset[0];


      if (!usuarioActualizado) {

        return res.status(404).json({
          error: 'Usuario no encontrado'
        });

      }


      // -------------------------------------------------
      // AUDITORÍA
      // -------------------------------------------------

      await registrarAuditoria({
        usuarioId: req.user.id,
        recurso: `Usuario ${usuarioId}`,
        accion: 'gestionar_usuarios',
        resultado: 'PERMITIDO',
        motivo: 'Usuario modificado correctamente',
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      });


      return res.json({

        mensaje: 'Usuario modificado correctamente',

        tipo_control: 'RBAC',

        usuario: req.user.nombre,

        rol: req.user.rol_nombre,

        usuario_actualizado: usuarioActualizado

      });


    } catch (error) {

      console.error('Error modificando usuario:', error);

      return res.status(500).json({
        error: 'Error modificando usuario'
      });

    }

  }
);


// =====================================================
// ACTIVAR / DESACTIVAR USUARIO
// RBAC: gestionar_usuarios
// =====================================================

router.put(
  '/:id/estado',
  authenticateToken,
  requirePermission('gestionar_usuarios'),
  async (req, res) => {

    try {

      const usuarioId = parseInt(req.params.id);

      if (isNaN(usuarioId)) {

        return res.status(400).json({
          error: 'ID de usuario inválido'
        });

      }


      const { estado } = req.body;


      // -------------------------------------------------
      // VALIDAR ESTADO
      // -------------------------------------------------

      if (
        estado !== 'activo' &&
        estado !== 'inactivo'
      ) {

        return res.status(400).json({
          error: 'El estado debe ser activo o inactivo'
        });

      }


      const pool = await poolPromise;


      // -------------------------------------------------
      // ACTUALIZAR ESTADO
      // -------------------------------------------------

      const result = await pool.request()
        .input('id', sql.Int, usuarioId)
        .input('estado', sql.VarChar, estado)
        .query(`
          UPDATE Usuario
          SET estado = @estado
          OUTPUT
            INSERTED.id,
            INSERTED.nombre,
            INSERTED.email,
            INSERTED.rol_id,
            INSERTED.departamento,
            INSERTED.nivel_seguridad,
            INSERTED.pais,
            INSERTED.tipo_contrato,
            INSERTED.estado
          WHERE id = @id
        `);


      const usuarioActualizado = result.recordset[0];


      if (!usuarioActualizado) {

        return res.status(404).json({
          error: 'Usuario no encontrado'
        });

      }


      // -------------------------------------------------
      // AUDITORÍA
      // -------------------------------------------------

      await registrarAuditoria({
        usuarioId: req.user.id,
        recurso: `Usuario ${usuarioId}`,
        accion: 'gestionar_usuarios',
        resultado: 'PERMITIDO',
        motivo: `Usuario ${estado === 'activo' ? 'activado' : 'desactivado'}`,
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      });


      return res.json({

        mensaje:
          estado === 'activo'
            ? 'Usuario activado correctamente'
            : 'Usuario desactivado correctamente',

        tipo_control: 'RBAC',

        usuario: req.user.nombre,

        rol: req.user.rol_nombre,

        usuario_actualizado: usuarioActualizado

      });


    } catch (error) {

      console.error('Error cambiando estado del usuario:', error);

      return res.status(500).json({
        error: 'Error cambiando estado del usuario'
      });

    }

  }
);


// =====================================================
// ASIGNAR ROL
// RBAC: gestionar_usuarios
// =====================================================

router.put(
  '/:id/rol',
  authenticateToken,
  requirePermission('gestionar_usuarios'),
  async (req, res) => {

    try {

      const usuarioId = parseInt(req.params.id);

      if (isNaN(usuarioId)) {

        return res.status(400).json({
          error: 'ID de usuario inválido'
        });

      }


      const { rol_id } = req.body;


      // -------------------------------------------------
      // VALIDAR ROL
      // -------------------------------------------------

      if (rol_id === undefined) {

        return res.status(400).json({
          error: 'rol_id es requerido'
        });

      }


      const pool = await poolPromise;


      // -------------------------------------------------
      // VERIFICAR QUE EL ROL EXISTA
      // -------------------------------------------------

      const rolResult = await pool.request()
        .input('rol_id', sql.Int, Number(rol_id))
        .query(`
          SELECT id, nombre
          FROM Rol
          WHERE id = @rol_id
        `);


      const rol = rolResult.recordset[0];


      if (!rol) {

        return res.status(400).json({
          error: 'El rol indicado no existe'
        });

      }


      // -------------------------------------------------
      // ASIGNAR ROL
      // -------------------------------------------------

      const result = await pool.request()
        .input('id', sql.Int, usuarioId)
        .input('rol_id', sql.Int, Number(rol_id))
        .query(`
          UPDATE Usuario
          SET rol_id = @rol_id
          OUTPUT
            INSERTED.id,
            INSERTED.nombre,
            INSERTED.email,
            INSERTED.rol_id,
            INSERTED.departamento,
            INSERTED.nivel_seguridad,
            INSERTED.pais,
            INSERTED.tipo_contrato,
            INSERTED.estado
          WHERE id = @id
        `);


      const usuarioActualizado = result.recordset[0];


      if (!usuarioActualizado) {

        return res.status(404).json({
          error: 'Usuario no encontrado'
        });

      }


      // -------------------------------------------------
      // AUDITORÍA
      // -------------------------------------------------

      await registrarAuditoria({
        usuarioId: req.user.id,
        recurso: `Usuario ${usuarioId}`,
        accion: 'gestionar_usuarios',
        resultado: 'PERMITIDO',
        motivo: `Rol asignado: ${rol.nombre}`,
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      });


      return res.json({

        mensaje: 'Rol asignado correctamente',

        tipo_control: 'RBAC',

        usuario: req.user.nombre,

        rol: req.user.rol_nombre,

        nuevo_rol: rol.nombre,

        usuario_actualizado: usuarioActualizado

      });


    } catch (error) {

      console.error('Error asignando rol:', error);

      return res.status(500).json({
        error: 'Error asignando rol'
      });

    }

  }
);


module.exports = router;