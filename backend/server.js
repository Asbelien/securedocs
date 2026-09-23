require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { poolPromise } = require('./config/db');

// =====================================================
// RUTAS
// =====================================================

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const userRoutes = require('./routes/userRoutes');

// =====================================================
// CREAR APLICACIÓN
// =====================================================

const app = express();

// =====================================================
// MIDDLEWARES GLOBALES
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// RUTA PRINCIPAL
// =====================================================

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API SecureDocs funcionando'
  });
});

// =====================================================
// RUTAS DE LA API
// =====================================================

// Autenticación
app.use('/api/auth', authRoutes);

// Documentos
app.use('/api/documentos', documentRoutes);

// Auditoría
app.use('/api/auditoria', auditRoutes);

// Usuarios
app.use('/api/usuarios', userRoutes);

// =====================================================
// PUERTO
// =====================================================

const PORT = process.env.PORT || 3000;

// =====================================================
// INICIAR SERVIDOR
// =====================================================

async function iniciarServidor() {

  try {

    await poolPromise;

    app.listen(PORT, () => {

      console.log(
        `Servidor corriendo en http://localhost:${PORT}`
      );

    });

  } catch (error) {

    console.error(
      'No se pudo iniciar el servidor:',
      error
    );

    process.exit(1);
  }
}

iniciarServidor();