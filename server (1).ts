// Truco Che - Servidor principal
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { WalletService } from './wallet';
import { RoomManager } from './roomManager';
import { RoomManagerChinchon } from './roomManagerChinchon';
import { AuthService, ErrorAuth } from './auth';
import { crearMiddlewareAuth, crearMiddlewareAuthSocket, RequestConUsuario } from './authMiddleware';
import { StatsService } from './statsService';

const app = express();
app.use(cors()); // Permite pedidos desde el frontend (cualquier origen, simple para el MVP)
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const wallet = new WalletService(pool);
const authService = new AuthService(pool);
const stats = new StatsService(pool);
const roomManager = new RoomManager(io, wallet, stats);
const roomManagerChinchon = new RoomManagerChinchon(io, wallet, stats);
const requiereAuth = crearMiddlewareAuth(authService);

// Los sockets requieren un JWT válido para conectarse (se manda en el handshake, no en cada evento)
io.use(crearMiddlewareAuthSocket(authService));

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id} (usuario ${(socket.data as any).usuarioId})`);
  roomManager.registrarHandlers(socket);
  roomManagerChinchon.registrarHandlers(socket);
});

// ============ RUTAS DE AUTENTICACIÓN ============

app.post('/api/auth/registro', async (req, res) => {
  try {
    const { email, password, nombre, fechaNacimiento } = req.body;
    if (!email || !password || !nombre || !fechaNacimiento) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const resultado = await authService.registrarConEmail({ email, password, nombre, fechaNacimiento });
    res.status(201).json(resultado);
  } catch (err) {
    if (err instanceof ErrorAuth) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });
    const resultado = await authService.loginConEmail(email, password);
    res.json(resultado);
  } catch (err) {
    if (err instanceof ErrorAuth) return res.status(401).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// El frontend obtiene el idToken con Google Identity Services y lo manda acá.
// Si es un usuario nuevo y no se mandó fechaNacimiento, devuelve un código para
// que el frontend muestre un paso extra pidiendo la fecha antes de reintentar.
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken, fechaNacimiento } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Falta idToken' });
    const resultado = await authService.loginConGoogle(idToken, fechaNacimiento);
    res.json(resultado);
  } catch (err) {
    if (err instanceof ErrorAuth) {
      if (err.message === 'FALTA_FECHA_NACIMIENTO') {
        return res.status(200).json({ requiereFechaNacimiento: true });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/api/auth/me', requiereAuth, async (req: RequestConUsuario, res) => {
  const result = await pool.query(
    'SELECT id, email, nombre, avatar_url FROM usuarios WHERE id = $1',
    [req.usuarioId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(result.rows[0]);
});

// ============ RUTAS REST BÁSICAS ============

app.get('/api/salud', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/paquetes-fichas', async (_req, res) => {
  const result = await pool.query(
    'SELECT * FROM paquetes_fichas WHERE activo = true ORDER BY orden ASC'
  );
  res.json(result.rows);
});

// Protegida: solo el propio usuario puede ver su saldo (usa el id del token, no de la URL)
app.get('/api/billetera', requiereAuth, async (req: RequestConUsuario, res) => {
  try {
    const saldo = await wallet.obtenerSaldo(req.usuarioId!);
    res.json({ saldo });
  } catch (err) {
    res.status(404).json({ error: 'Billetera no encontrada' });
  }
});

// Webhook de Mercado Pago: acredita fichas cuando se confirma un pago
app.post('/api/webhooks/mercadopago', async (req, res) => {
  // NOTA: acá va la validación real de la firma del webhook de Mercado Pago
  // y la consulta a su API para confirmar el estado del pago antes de acreditar.
  // Esto es un esqueleto, no usar en producción sin esa validación.
  const { usuarioId, compraId, fichas, estado } = req.body;

  if (estado === 'approved') {
    await wallet.acreditarPorCompra(usuarioId, compraId, fichas);
    await pool.query(
      `UPDATE compras SET estado = 'aprobado', confirmado_en = now() WHERE id = $1`,
      [compraId]
    );
  }

  res.sendStatus(200);
});

app.get('/api/ranking', async (_req, res) => {
  const filas = await stats.obtenerRanking(50);
  res.json(filas);
});

app.get('/api/ranking/yo', requiereAuth, async (req: RequestConUsuario, res) => {
  const resultado = await stats.obtenerPosicionUsuario(req.usuarioId!);
  if (!resultado) return res.json({ posicion: null, stats: null }); // el usuario todavía no jugó ninguna partida
  res.json(resultado);
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Truco Che backend corriendo en puerto ${PORT}`);
});
