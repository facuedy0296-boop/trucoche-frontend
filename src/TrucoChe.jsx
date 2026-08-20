import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

/* ============================================================
   TRUCO CHE — Frontend conectado al backend real
   Paleta: paño verde #1B3A2C, hueso #EDE4D2, cuero #4A3222,
   ficha dorada #C9A227, espada roja #8B2E2E

   Auth: fetch real contra /api/auth/* (proxy de Vite -> :4000)
   Juego: socket.io-client real, autenticado con el JWT guardado
   ============================================================ */

const BACKEND_SOCKET_URL = "https://trucoche-backend-production.up.railway.app";
const API_BASE = BACKEND_SOCKET_URL; // misma URL del backend, para las llamadas fetch de la API REST

function guardarSesion(token, usuario) {
  localStorage.setItem("trucoche_token", token);
  localStorage.setItem("trucoche_usuario", JSON.stringify(usuario));
}
function leerSesion() {
  const token = localStorage.getItem("trucoche_token");
  const usuario = localStorage.getItem("trucoche_usuario");
  if (!token || !usuario) return null;
  return { token, usuario: JSON.parse(usuario) };
}
function borrarSesion() {
  localStorage.removeItem("trucoche_token");
  localStorage.removeItem("trucoche_usuario");
}

const PALOS = {
  espada: { color: "#3A5A8C", nombre: "Espada" },
  basto: { color: "#5C4130", nombre: "Basto" },
  oro: { color: "#B8860B", nombre: "Oro" },
  copa: { color: "#8B2E2E", nombre: "Copa" },
};

// Ilustraciones SVG propias para cada palo de la baraja española (no emojis).
function IconoPalo({ palo, size = 22 }) {
  const c = PALOS[palo].color;
  if (palo === "espada") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2 L13.4 12 L12 22 L10.6 12 Z" fill={c} />
        <rect x="6" y="10.5" width="12" height="2.2" rx="0.6" fill={c} />
        <rect x="11" y="13" width="2" height="6" rx="0.5" fill={c} />
        <circle cx="12" cy="19.5" r="1.6" fill={c} />
      </svg>
    );
  }
  if (palo === "basto") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M9 21 C7 15 8 9 12 3 C16 9 17 15 15 21 Z" fill={c} />
        <path d="M12 3 C12.8 6 12.8 9 12 12" stroke="#EDE4D2" strokeWidth="0.7" opacity="0.5" />
      </svg>
    );
  }
  if (palo === "oro") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill={c} />
        <circle cx="12" cy="12" r="9" fill="none" stroke="#8A6508" strokeWidth="1" />
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="#F5EEDD" strokeWidth="0.8" opacity="0.6" />
      </svg>
    );
  }
  // copa
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 4 H18 C18 10 15.5 13 12 13 C8.5 13 6 10 6 4 Z" fill={c} />
      <rect x="11" y="13" width="2" height="5" fill={c} />
      <rect x="7.5" y="18" width="9" height="2" rx="0.8" fill={c} />
    </svg>
  );
}

function CartaMini({ numero, palo }) {
  const p = PALOS[palo];
  const esFigura = numero >= 10;
  return (
    <div
      style={{
        width: 56,
        height: 80,
        borderRadius: 7,
        background: "linear-gradient(160deg, #FBF7EC 0%, #F0E8D4 55%, #EAE0C8 100%)",
        border: `1px solid ${p.color}33`,
        boxShadow: "0 4px 8px rgba(0,0,0,0.4), inset 0 0 0 3px rgba(255,255,255,0.5)",
        position: "relative",
        userSelect: "none",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Número esquina superior */}
      <div style={{ position: "absolute", top: 4, left: 5, color: p.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, lineHeight: 1 }}>
        {numero}
      </div>
      {/* Marca de agua central */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: esFigura ? 0.9 : 0.16 }}>
        <IconoPalo palo={palo} size={esFigura ? 30 : 40} />
      </div>
      {/* Número esquina inferior (invertido, como cartas reales) */}
      <div style={{ position: "absolute", bottom: 4, right: 5, color: p.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, lineHeight: 1, transform: "rotate(180deg)" }}>
        {numero}
      </div>
      <div style={{ position: "absolute", top: 20, left: 5 }}>
        <IconoPalo palo={palo} size={11} />
      </div>
    </div>
  );
}

function CartaDorso() {
  return (
    <div
      style={{
        width: 56,
        height: 80,
        borderRadius: 7,
        background: "linear-gradient(135deg, #1B3A2C 0%, #234A38 50%, #1B3A2C 100%)",
        border: "1px solid #0F241C",
        boxShadow: "0 4px 8px rgba(0,0,0,0.4)",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", inset: 4, borderRadius: 4,
        border: "1.5px solid #C9A227", opacity: 0.5,
      }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#C9A227", fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, opacity: 0.85 }}>C</span>
      </div>
    </div>
  );
}

/* ---------------- AVATARES ---------------- */
// 16 emblemas propios, cada uno combina un palo de la baraja con un fondo y patrón
// distinto — nada de iniciales genéricas ni gradientes de stock.

const AVATAR_SET = [
  { bg: "#1B3A2C", palo: "espada", anillo: "#C9A227" },
  { bg: "#8B2E2E", palo: "copa", anillo: "#EDE4D2" },
  { bg: "#4A3222", palo: "basto", anillo: "#C9A227" },
  { bg: "#2E5A8B", palo: "espada", anillo: "#EDE4D2" },
  { bg: "#C9A227", palo: "oro", anillo: "#1B3A2C" },
  { bg: "#5C1F1F", palo: "basto", anillo: "#C9A227" },
  { bg: "#234A38", palo: "copa", anillo: "#C9A227" },
  { bg: "#3A2A1A", palo: "espada", anillo: "#8B2E2E" },
  { bg: "#8B5E3C", palo: "oro", anillo: "#1B3A2C" },
  { bg: "#1F2E4A", palo: "copa", anillo: "#C9A227" },
  { bg: "#6B1E1E", palo: "espada", anillo: "#EDE4D2" },
  { bg: "#2E4A2E", palo: "oro", anillo: "#EDE4D2" },
  { bg: "#4A1F3A", palo: "basto", anillo: "#C9A227" },
  { bg: "#7A4A1E", palo: "copa", anillo: "#1B3A2C" },
  { bg: "#1E3A4A", palo: "basto", anillo: "#C9A227" },
  { bg: "#3A1E2E", palo: "oro", anillo: "#EDE4D2" },
];

function AvatarIcon({ avatarId = 0, size = 44 }) {
  const a = AVATAR_SET[avatarId % AVATAR_SET.length];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: a.bg,
        border: `2px solid ${a.anillo}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      <IconoPaloClaro palo={a.palo} size={Math.round(size * 0.5)} color={a.anillo} />
    </div>
  );
}

// Versión del ícono de palo en un solo color (para que contraste bien sobre el fondo del avatar)
function IconoPaloClaro({ palo, size, color }) {
  if (palo === "espada") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2 L13.4 12 L12 22 L10.6 12 Z" fill={color} />
        <rect x="6" y="10.5" width="12" height="2.2" rx="0.6" fill={color} />
        <rect x="11" y="13" width="2" height="6" rx="0.5" fill={color} />
        <circle cx="12" cy="19.5" r="1.6" fill={color} />
      </svg>
    );
  }
  if (palo === "basto") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M9 21 C7 15 8 9 12 3 C16 9 17 15 15 21 Z" fill={color} />
      </svg>
    );
  }
  if (palo === "oro") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 4 H18 C18 10 15.5 13 12 13 C8.5 13 6 10 6 4 Z" fill={color} />
      <rect x="11" y="13" width="2" height="5" fill={color} />
      <rect x="7.5" y="18" width="9" height="2" rx="0.8" fill={color} />
    </svg>
  );
}



function PantallaAuth({ onIngresar }) {
  const [modo, setModo] = useState("login"); // login | registro
  const [form, setForm] = useState({ email: "", password: "", nombre: "", fechaNacimiento: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Completá email y contraseña.");
      return;
    }

    setCargando(true);
    try {
      const ruta = modo === "login" ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/registro`;
      const res = await fetch(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ocurrió un error, intentá de nuevo.");
        setCargando(false);
        return;
      }

      guardarSesion(data.token, data.usuario);
      onIngresar(data.usuario, data.token);
    } catch (err) {
      setError("No se pudo conectar con el servidor. ¿Está corriendo el backend?");
    }
    setCargando(false);
  }

  // Nota: para habilitar el botón de Google de verdad, hay que cargar el script de
  // Google Identity Services (https://accounts.google.com/gsi/client) en index.html
  // e inicializarlo con tu GOOGLE_CLIENT_ID. Este botón queda listo para conectar
  // esa parte una vez que tengas el Client ID configurado en el backend.
  function manejarGoogle() {
    setError("El login con Google se habilita configurando GOOGLE_CLIENT_ID en el backend (ver README).");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background:
          "radial-gradient(ellipse at 50% -10%, #2A4F3B 0%, #16301F 55%, #0D1F14 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Work Sans', sans-serif",
        padding: 24,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,900&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#EDE4D2",
          borderRadius: 18,
          padding: "40px 36px",
          boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* marca de agua de palo, detalle de firma */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            fontSize: 140,
            color: "#8B2E2E",
            opacity: 0.07,
            transform: "rotate(12deg)",
          }}
        >
          ⚔
        </div>

        <div style={{ textAlign: "center", marginBottom: 8, position: "relative" }}>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 900,
              fontSize: 40,
              letterSpacing: "-0.02em",
              color: "#1B3A2C",
              margin: 0,
            }}
          >
            Truco <span style={{ color: "#8B2E2E", fontStyle: "italic", fontWeight: 600 }}>Che</span>
          </h1>
          <p
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.12em",
              color: "#5C4130",
              marginTop: 6,
              textTransform: "uppercase",
            }}
          >
            Mesa criolla · +18
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, margin: "24px 0 20px", background: "#DCD0B4", borderRadius: 10, padding: 4 }}>
          {["login", "registro"].map((m) => (
            <button
              key={m}
              onClick={() => { setModo(m); setError(""); }}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Work Sans', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                background: modo === m ? "#1B3A2C" : "transparent",
                color: modo === m ? "#EDE4D2" : "#5C4130",
                transition: "all 0.15s",
              }}
            >
              {m === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <button
          onClick={manejarGoogle}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 9,
            border: "1.5px solid #C9BFA6",
            background: "#FBF8F1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            fontFamily: "'Work Sans', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#2A2118",
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
          </svg>
          Continuar con Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#C9BFA6" }} />
          <span style={{ fontSize: 11, color: "#8A7B5E", fontFamily: "'IBM Plex Mono', monospace" }}>O</span>
          <div style={{ flex: 1, height: 1, background: "#C9BFA6" }} />
        </div>

        <form onSubmit={manejarSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {modo === "registro" && (
            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={inputStyle}
          />
          {modo === "registro" && (
            <label style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: "#5C4130" }}>
              Fecha de nacimiento
              <input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
                style={{ ...inputStyle, marginTop: 5 }}
              />
            </label>
          )}

          {error && (
            <div style={{ color: "#8B2E2E", fontSize: 13, fontFamily: "'Work Sans', sans-serif", fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              marginTop: 6,
              padding: "13px 0",
              borderRadius: 9,
              border: "none",
              background: "#C9A227",
              color: "#1B3A2C",
              fontWeight: 700,
              fontFamily: "'Work Sans', sans-serif",
              fontSize: 15,
              cursor: cargando ? "default" : "pointer",
              opacity: cargando ? 0.7 : 1,
              boxShadow: "0 6px 14px rgba(201,162,39,0.35)",
            }}
          >
            {cargando ? "Un momento…" : modo === "login" ? "Entrar a la mesa" : "Crear cuenta"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 11, color: "#8A7B5E", marginTop: 18, fontFamily: "'Work Sans', sans-serif" }}>
          Jugás con fichas virtuales sin valor de retiro a dinero real.
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 9,
  border: "1.5px solid #C9BFA6",
  background: "#FBF8F1",
  fontFamily: "'Work Sans', sans-serif",
  fontSize: 14,
  color: "#2A2118",
  outline: "none",
  boxSizing: "border-box",
};

/* ---------------- PANTALLA: LOBBY (buscar mesa) ---------------- */

function PantallaLobby({ usuario, token, onEntrarMesa, onSalir, onVerRanking, onVerPerfil }) {
  const [fichas, setFichas] = useState(null);
  const [apuestaSel, setApuestaSel] = useState(50);
  const [juegoSel, setJuegoSel] = useState("truco"); // 'truco' | 'chinchon'
  const [errorFichas, setErrorFichas] = useState("");
  const opciones = [20, 50, 100, 200];

  useEffect(() => {
    fetch(`${API_BASE}/api/billetera`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.saldo !== undefined) setFichas(data.saldo);
        else setErrorFichas("No se pudo cargar tu saldo de fichas.");
      })
      .catch(() => setErrorFichas("No se pudo conectar con el servidor."));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#16301F", fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@900&family=IBM+Plex+Mono:wght@600&display=swap');`}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid #23422F" }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 24, color: "#EDE4D2", margin: 0 }}>
          Truco <span style={{ color: "#C9A227", fontStyle: "italic" }}>Che</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#1B3A2C", padding: "7px 14px", borderRadius: 20,
              border: "1px solid #C9A227",
            }}
          >
            <span style={{ color: "#C9A227", fontSize: 15 }}>●</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#EDE4D2", fontWeight: 600, fontSize: 14 }}>
              {fichas === null ? "…" : fichas.toLocaleString()}
            </span>
          </div>
          <button onClick={onVerPerfil} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <AvatarIcon avatarId={usuario.avatarId} size={32} />
            <span style={{ color: "#B7AA88", fontSize: 14 }}>{usuario.nombre}</span>
          </button>
          <button onClick={onVerRanking} style={{ background: "none", border: "1px solid #3A5A47", color: "#EDE4D2", cursor: "pointer", fontSize: 13, padding: "6px 14px", borderRadius: 8 }}>
            🏆 Ranking
          </button>
          <button onClick={onSalir} style={{ background: "none", border: "none", color: "#8A7B5E", cursor: "pointer", fontSize: 13 }}>
            Salir
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px", textAlign: "center" }}>
        <p style={{ color: "#B7AA88", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
          Elegí la mesa
        </p>
        <h2 style={{ color: "#EDE4D2", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, marginTop: 0, marginBottom: 24 }}>
          ¿A qué jugamos?
        </h2>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 34 }}>
          {[{ id: "truco", label: "Truco" }, { id: "chinchon", label: "Chinchón" }].map((j) => (
            <button
              key={j.id}
              onClick={() => setJuegoSel(j.id)}
              style={{
                padding: "12px 32px",
                borderRadius: 10,
                border: juegoSel === j.id ? "2px solid #C9A227" : "1.5px solid #2E5540",
                background: juegoSel === j.id ? "rgba(201,162,39,0.12)" : "#1B3A2C",
                color: "#EDE4D2",
                fontFamily: "'Fraunces', serif",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {j.label}
            </button>
          ))}
        </div>

        <p style={{ color: "#B7AA88", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
          ¿Cuántas fichas ponés en juego?
        </p>

        {errorFichas && (
          <p style={{ color: "#D97757", fontSize: 13, marginBottom: 18 }}>{errorFichas}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 34 }}>
          {opciones.map((o) => (
            <button
              key={o}
              onClick={() => setApuestaSel(o)}
              disabled={o > fichas}
              style={{
                padding: "18px 0",
                borderRadius: 12,
                border: apuestaSel === o ? "2px solid #C9A227" : "1.5px solid #2E5540",
                background: apuestaSel === o ? "rgba(201,162,39,0.12)" : "#1B3A2C",
                color: o > fichas ? "#5C6E62" : "#EDE4D2",
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                fontSize: 16,
                cursor: o > fichas ? "not-allowed" : "pointer",
              }}
            >
              {o}
            </button>
          ))}
        </div>

        <button
          onClick={() => onEntrarMesa(apuestaSel, juegoSel)}
          style={{
            padding: "16px 48px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #C9A227, #B08A1E)",
            color: "#1B3A2C",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(201,162,39,0.3)",
          }}
        >
          Buscar rival →
        </button>

        <p style={{ marginTop: 40, color: "#5C6E62", fontSize: 12 }}>
          Las fichas se compran con dinero real y no tienen valor de retiro.
        </p>
      </main>
    </div>
  );
}

/* ---------------- PANTALLA: BUSCANDO RIVAL ---------------- */

function PantallaBuscando({ usuario, socket, apuesta, juego, onEncontrado, onCancelar, onError }) {
  const eventoIniciado = juego === "chinchon" ? "chinchon:partida_iniciada" : "partida_iniciada";
  const eventoError = juego === "chinchon" ? "chinchon:error_jugada" : "error_jugada";
  const eventoBuscar = juego === "chinchon" ? "chinchon:buscar_partida" : "buscar_partida";

  useEffect(() => {
    if (!socket) return;

    function alIniciar(estado) {
      onEncontrado(estado);
    }
    function alError(err) {
      onError(err.mensaje || "No se pudo entrar a la mesa.");
    }

    socket.on(eventoIniciado, alIniciar);
    socket.on(eventoError, alError);
    socket.emit(eventoBuscar, { nombre: usuario.nombre, fichasApuesta: apuesta });

    return () => {
      socket.off(eventoIniciado, alIniciar);
      socket.off(eventoError, alError);
    };
  }, [socket, apuesta, onEncontrado, onError, usuario.nombre, eventoIniciado, eventoError, eventoBuscar]);

  return (
    <div style={{ minHeight: "100vh", background: "#16301F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        border: "3px solid #2E5540", borderTopColor: "#C9A227",
        animation: "girar 0.9s linear infinite", marginBottom: 24,
      }} />
      <style>{`@keyframes girar { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "#EDE4D2", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, letterSpacing: "0.08em" }}>
        BUSCANDO RIVAL · {juego === "chinchon" ? "CHINCHÓN" : "TRUCO"} · MESA DE {apuesta} FICHAS
      </p>
      <button onClick={onCancelar} style={{ marginTop: 30, background: "none", border: "1px solid #5C6E62", color: "#B7AA88", padding: "8px 20px", borderRadius: 8, cursor: "pointer" }}>
        Cancelar
      </button>
    </div>
  );
}

/* ---------------- PANTALLA: MESA DE JUEGO ---------------- */

function PantallaMesa({ usuario, socket, apuesta, estadoInicial, onSalirMesa }) {
  // idxPropio ahora viene explícito del servidor en cada evento — ya no se infiere en el cliente.
  const [idxPropio, setIdxPropio] = useState(estadoInicial?.idxPropio ?? null);
  const [puntos, setPuntos] = useState(estadoInicial?.estado?.puntos || [0, 0]);
  const [manoJugador, setManoJugador] = useState(estadoInicial?.estado?.manoPropia || []);
  const [cartasRivalRestantes, setCartasRivalRestantes] = useState(estadoInicial?.estado?.cartasRivalRestantes ?? 3);
  const [cartasMesa, setCartasMesa] = useState({ propia: null, rival: null });
  const [trucoNivel, setTrucoNivel] = useState(null);
  const [mensajeEnvite, setMensajeEnvite] = useState(null);
  const [finPartida, setFinPartida] = useState(null);
  const [enviteRecibido, setEnviteRecibido] = useState(null); // { tipo: 'truco'|'envido', valor }

  useEffect(() => {
    if (!socket) return;

    function alEstadoActualizado({ idxPropio: idx, estado }) {
      setIdxPropio(idx);
      setPuntos(estado.puntos);
      setManoJugador(estado.manoPropia);
      setCartasRivalRestantes(estado.cartasRivalRestantes);
    }
    function alTrucoCantado({ idxPropio: idx, por, nivel, estado }) {
      setIdxPropio(idx);
      setTrucoNivel(nivel);
      setPuntos(estado.puntos);
      setMensajeEnvite(`Cantaron ${nivel.replace("_", " ")}`);
      if (por !== idx) setEnviteRecibido({ tipo: "truco", valor: nivel });
    }
    function alTrucoQuerido({ idxPropio: idx, estado }) {
      setIdxPropio(idx);
      setPuntos(estado.puntos);
      setEnviteRecibido(null);
      setMensajeEnvite("Truco querido");
      setTimeout(() => setMensajeEnvite(null), 1500);
    }
    function alEnvidoCantado({ idxPropio: idx, por, tipo, estado }) {
      setIdxPropio(idx);
      setPuntos(estado.puntos);
      setMensajeEnvite(`Cantaron ${tipo.replace("_", " ")}`);
      if (por !== idx) setEnviteRecibido({ tipo: "envido", valor: tipo });
    }
    function alEnvidoResuelto({ idxPropio: idx, puntosGanados, estado }) {
      setIdxPropio(idx);
      setPuntos(estado.puntos);
      setEnviteRecibido(null);
      setMensajeEnvite(`Envido: +${puntosGanados} fichas`);
      setTimeout(() => setMensajeEnvite(null), 2000);
    }
    function alManoFinalizada({ idxPropio: idx, puntosGanados, estado }) {
      setIdxPropio(idx);
      setPuntos(estado.puntos);
      setManoJugador(estado.manoPropia);
      setCartasRivalRestantes(estado.cartasRivalRestantes);
      setTrucoNivel(null);
      setCartasMesa({ propia: null, rival: null });
      setMensajeEnvite(`Mano ganada: +${puntosGanados}`);
      setTimeout(() => setMensajeEnvite(null), 2000);
    }
    function alPartidaFinalizada({ ganadorId, premioNeto }) {
      setFinPartida({ gane: ganadorId === usuario.id, premioNeto });
    }
    function alRivalDesconectado() {
      setFinPartida({ gane: true, premioNeto: apuesta * 2, motivo: "El rival se desconectó" });
    }
    function alErrorJugada({ mensaje }) {
      setMensajeEnvite(mensaje);
      setTimeout(() => setMensajeEnvite(null), 2000);
    }

    socket.on("estado_actualizado", alEstadoActualizado);
    socket.on("truco_cantado", alTrucoCantado);
    socket.on("truco_querido", alTrucoQuerido);
    socket.on("envido_cantado", alEnvidoCantado);
    socket.on("envido_resuelto", alEnvidoResuelto);
    socket.on("mano_finalizada", alManoFinalizada);
    socket.on("partida_finalizada", alPartidaFinalizada);
    socket.on("rival_desconectado", alRivalDesconectado);
    socket.on("error_jugada", alErrorJugada);

    return () => {
      socket.off("estado_actualizado", alEstadoActualizado);
      socket.off("truco_cantado", alTrucoCantado);
      socket.off("truco_querido", alTrucoQuerido);
      socket.off("envido_cantado", alEnvidoCantado);
      socket.off("envido_resuelto", alEnvidoResuelto);
      socket.off("mano_finalizada", alManoFinalizada);
      socket.off("partida_finalizada", alPartidaFinalizada);
      socket.off("rival_desconectado", alRivalDesconectado);
      socket.off("error_jugada", alErrorJugada);
    };
  }, [socket, usuario.id, apuesta]);

  function jugarCarta(carta) {
    socket.emit("jugar_carta", { carta });
    setCartasMesa((prev) => ({ ...prev, propia: carta }));
    setManoJugador((prev) => prev.filter((c) => !(c.numero === carta.numero && c.palo === carta.palo)));
  }

  function cantarTruco(nivel) {
    socket.emit("cantar_truco", { nivel });
  }

  function cantarEnvido(tipo) {
    socket.emit("cantar_envido", { tipo });
  }

  function responder(quiero) {
    if (!enviteRecibido) return;
    if (enviteRecibido.tipo === "truco") socket.emit("responder_truco", { quiero });
    else socket.emit("responder_envido", { quiero });
    setEnviteRecibido(null);
  }

  if (finPartida) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D1F14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Work Sans', sans-serif", gap: 18 }}>
        <h2 style={{ color: finPartida.gane ? "#C9A227" : "#8B2E2E", fontFamily: "'Fraunces', serif", fontSize: 32 }}>
          {finPartida.gane ? "¡Ganaste la partida!" : "Perdiste esta partida"}
        </h2>
        {finPartida.motivo && <p style={{ color: "#B7AA88" }}>{finPartida.motivo}</p>}
        <button onClick={onSalirMesa} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: "#C9A227", color: "#1B3A2C", fontWeight: 700, cursor: "pointer" }}>
          Volver al lobby
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1F14", fontFamily: "'Work Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=IBM+Plex+Mono:wght@500;600&display=swap');`}</style>

      {/* Header con marcador */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px" }}>
        <button onClick={onSalirMesa} style={{ background: "none", border: "none", color: "#5C6E62", cursor: "pointer", fontSize: 13 }}>
          ← Abandonar
        </button>
        <div style={{ display: "flex", gap: 24, alignItems: "center", fontFamily: "'IBM Plex Mono', monospace" }}>
          <Marcador nombre={usuario.nombre} puntos={idxPropio === null ? puntos[1] : puntos[idxPropio]} activo />
          <span style={{ color: "#4A6350", fontSize: 20 }}>—</span>
          <Marcador nombre="Rival" puntos={idxPropio === null ? puntos[0] : puntos[1 - idxPropio]} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#C9A227", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14 }}>
          ● {apuesta} en juego
        </div>
      </header>

      {/* Mesa circular — el elemento de firma del diseño */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div
          style={{
            width: "min(560px, 90vw)",
            height: "min(560px, 90vw)",
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 40%, #234A38 0%, #1B3A2C 60%, #123020 100%), repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 3px)",
            border: "10px solid #4A3222",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.5)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
          }}
        >
          {/* marca de agua palos en el paño */}
          {["espada", "basto", "oro", "copa"].map((p, i) => (
            <div
              key={p}
              style={{
                position: "absolute",
                opacity: 0.1,
                top: `${18 + (i % 2) * 64}%`,
                left: `${i < 2 ? 12 : 78}%`,
              }}
            >
              <IconoPalo palo={p} size={34} />
            </div>
          ))}

          {/* Mano del rival (dorsos) */}
          <div style={{ display: "flex", gap: 10 }}>
            {Array.from({ length: cartasRivalRestantes }).map((_, i) => <CartaDorso key={i} />)}
          </div>

          {/* Cartas jugadas en el centro */}
          <div style={{ display: "flex", gap: 28, alignItems: "center", minHeight: 74 }}>
            {cartasMesa.rival ? <CartaMini {...cartasMesa.rival} /> : <div style={{ width: 52 }} />}
            {trucoNivel && (
              <div style={{
                background: "#8B2E2E", color: "#EDE4D2", padding: "6px 14px", borderRadius: 8,
                fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase",
                boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
              }}>
                {trucoNivel.replace("_", " ")}
              </div>
            )}
            {cartasMesa.propia ? <CartaMini {...cartasMesa.propia} /> : <div style={{ width: 52 }} />}
          </div>

          {mensajeEnvite && (
            <div style={{ position: "absolute", top: "8%", color: "#C9A227", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>
              {mensajeEnvite}
            </div>
          )}
        </div>
      </div>

      {/* Mano del jugador + acciones */}
      <footer style={{ padding: "20px 28px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {enviteRecibido && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            background: "#1B3A2C", border: "1.5px solid #C9A227", borderRadius: 12,
            padding: "12px 20px",
          }}>
            <span style={{ color: "#EDE4D2", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: 14 }}>
              Te cantaron {enviteRecibido.valor.replace("_", " ")}
            </span>
            <button onClick={() => responder(true)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#C9A227", color: "#1B3A2C", fontWeight: 700, cursor: "pointer" }}>
              Quiero
            </button>
            <button onClick={() => responder(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid #8B2E2E", background: "transparent", color: "#EDE4D2", fontWeight: 600, cursor: "pointer" }}>
              No quiero
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 14 }}>
          {manoJugador.map((c, i) => (
            <div
              key={i}
              onClick={() => jugarCarta(c)}
              style={{ cursor: "pointer", transition: "transform 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-8px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <CartaMini numero={c.numero} palo={c.palo} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <BotonAccion label="Envido" onClick={() => cantarEnvido("envido")} />
          <BotonAccion label="Truco" destacado onClick={() => cantarTruco("truco")} disabled={!!trucoNivel} />
          <BotonAccion label="Retruco" onClick={() => cantarTruco("retruco")} disabled={trucoNivel !== "truco"} />
          <BotonAccion label="Vale cuatro" onClick={() => cantarTruco("vale_cuatro")} disabled={trucoNivel !== "retruco"} />
          <BotonAccion label="Ir al mazo" sutil onClick={() => {}} />
        </div>
      </footer>
    </div>
  );
}

function Marcador({ nombre, puntos, activo }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: activo ? "#C9A227" : "#6E8577", letterSpacing: "0.1em" }}>{nombre.toUpperCase()}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: "#EDE4D2" }}>{puntos}</div>
    </div>
  );
}

function BotonAccion({ label, onClick, destacado, sutil, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "11px 22px",
        borderRadius: 10,
        border: destacado ? "none" : "1.5px solid #3A5A47",
        background: destacado ? "#8B2E2E" : sutil ? "transparent" : "#1B3A2C",
        color: disabled ? "#4A5D52" : "#EDE4D2",
        fontFamily: "'Work Sans', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

/* ---------------- PANTALLA: RANKING ---------------- */

function PantallaRanking({ usuario, token, onVolver }) {
  const [filas, setFilas] = useState(null);
  const [miPosicion, setMiPosicion] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/ranking`).then((r) => r.json()),
      fetch(`${API_BASE}/api/ranking/yo`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([ranking, yo]) => {
        setFilas(ranking);
        setMiPosicion(yo.posicion ? yo : null);
      })
      .catch(() => setError("No se pudo cargar el ranking."));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#16301F", fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=IBM+Plex+Mono:wght@500;600&display=swap');`}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid #23422F" }}>
        <button onClick={onVolver} style={{ background: "none", border: "none", color: "#5C6E62", cursor: "pointer", fontSize: 13 }}>
          ← Volver al lobby
        </button>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, color: "#EDE4D2", margin: 0 }}>
          🏆 Ranking
        </h1>
        <div style={{ width: 100 }} />
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
        {error && <p style={{ color: "#D97757", textAlign: "center" }}>{error}</p>}

        {miPosicion && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(201,162,39,0.12)", border: "1.5px solid #C9A227", borderRadius: 12,
            padding: "14px 20px", marginBottom: 24,
          }}>
            <span style={{ color: "#EDE4D2", fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
              Tu puesto: #{miPosicion.posicion}
            </span>
            <span style={{ color: "#C9A227", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
              ● {miPosicion.stats.fichasGanadasTotal.toLocaleString()} fichas ganadas
            </span>
          </div>
        )}

        {filas === null && !error && (
          <p style={{ color: "#5C6E62", textAlign: "center" }}>Cargando…</p>
        )}

        {filas && filas.length === 0 && (
          <p style={{ color: "#5C6E62", textAlign: "center" }}>Todavía nadie jugó una partida. ¡Sé el primero!</p>
        )}

        {filas && filas.map((f, i) => (
          <div
            key={f.usuarioId}
            style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "12px 16px", borderRadius: 10,
              background: f.usuarioId === usuario.id ? "rgba(201,162,39,0.08)" : "transparent",
              borderBottom: "1px solid #1F3D2E",
            }}
          >
            <span style={{
              width: 28, textAlign: "center",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
              color: i === 0 ? "#C9A227" : i === 1 ? "#B7AA88" : i === 2 ? "#8B5E3C" : "#5C6E62",
            }}>
              {i + 1}
            </span>
            <AvatarIcon avatarId={f.avatarId ?? 0} size={32} />
            <span style={{ flex: 1, color: "#EDE4D2", fontWeight: f.usuarioId === usuario.id ? 700 : 400 }}>
              {f.nombre}{f.usuarioId === usuario.id ? " (vos)" : ""}
            </span>
            <span style={{ color: "#B7AA88", fontSize: 13 }}>
              {f.partidasGanadas}/{f.partidasJugadas} ({f.porcentajeVictorias}%)
            </span>
            <span style={{ color: "#C9A227", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, minWidth: 90, textAlign: "right" }}>
              ● {f.fichasGanadasTotal.toLocaleString()}
            </span>
          </div>
        ))}
      </main>
    </div>
  );
}



/* ---------------- PANTALLA: MESA DE CHINCHÓN ---------------- */

function PantallaMesaChinchon({ usuario, socket, apuesta, estadoInicial, onSalirMesa }) {
  const [idxPropio, setIdxPropio] = useState(estadoInicial?.idxPropio ?? null);
  const [puntos, setPuntos] = useState(estadoInicial?.estado?.puntos || [0, 0]);
  const [manoJugador, setManoJugador] = useState(estadoInicial?.estado?.manoPropia || []);
  const [pozo, setPozo] = useState(estadoInicial?.estado?.pozo || []);
  const [fase, setFase] = useState(estadoInicial?.estado?.fase || "robar");
  const [turno, setTurno] = useState(estadoInicial?.estado?.turno ?? 0);
  const [cartasRivalRestantes, setCartasRivalRestantes] = useState(estadoInicial?.estado?.cartasRivalRestantes ?? 7);
  const [mensaje, setMensaje] = useState(null);
  const [finPartida, setFinPartida] = useState(null);
  const [cartaSeleccionada, setCartaSeleccionada] = useState(null);

  useEffect(() => {
    if (!socket) return;

    function actualizar({ idxPropio: idx, estado }) {
      setIdxPropio(idx);
      setPuntos(estado.puntos);
      setManoJugador(estado.manoPropia);
      setPozo(estado.pozo);
      setFase(estado.fase);
      setTurno(estado.turno);
      setCartasRivalRestantes(estado.cartasRivalRestantes);
    }
    function alRondaFinalizada({ cortoPor, puntosGanadosRonda, chinchonPor, idxPropio: idx, estado }) {
      actualizar({ idxPropio: idx, estado });
      const gane = cortoPor === idx;
      setMensaje(chinchonPor !== null
        ? (chinchonPor === idx ? "¡Chinchón! Ganaste la ronda" : "El rival cantó chinchón")
        : `${gane ? "Cortaste" : "El rival cortó"} la ronda`);
      setTimeout(() => setMensaje(null), 2500);
    }
    function alNuevaRonda({ idxPropio: idx, estado }) {
      actualizar({ idxPropio: idx, estado });
      setMensaje("Nueva ronda");
      setTimeout(() => setMensaje(null), 1500);
    }
    function alPartidaFinalizada({ ganadorId, premioNeto }) {
      setFinPartida({ gane: ganadorId === usuario.id, premioNeto });
    }
    function alRivalDesconectado() {
      setFinPartida({ gane: true, premioNeto: apuesta * 2, motivo: "El rival se desconectó" });
    }
    function alError({ mensaje: m }) {
      setMensaje(m);
      setTimeout(() => setMensaje(null), 2000);
    }

    socket.on("chinchon:estado_actualizado", actualizar);
    socket.on("chinchon:ronda_finalizada", alRondaFinalizada);
    socket.on("chinchon:nueva_ronda", alNuevaRonda);
    socket.on("chinchon:partida_finalizada", alPartidaFinalizada);
    socket.on("chinchon:rival_desconectado", alRivalDesconectado);
    socket.on("chinchon:error_jugada", alError);

    return () => {
      socket.off("chinchon:estado_actualizado", actualizar);
      socket.off("chinchon:ronda_finalizada", alRondaFinalizada);
      socket.off("chinchon:nueva_ronda", alNuevaRonda);
      socket.off("chinchon:partida_finalizada", alPartidaFinalizada);
      socket.off("chinchon:rival_desconectado", alRivalDesconectado);
      socket.off("chinchon:error_jugada", alError);
    };
  }, [socket, usuario.id, apuesta]);

  const esMiTurno = idxPropio !== null && turno === idxPropio;

  function robarMazo() { socket.emit("chinchon:robar_mazo"); }
  function robarPozo() { socket.emit("chinchon:robar_pozo"); }
  function descartarCarta(carta) { socket.emit("chinchon:descartar", { carta }); setCartaSeleccionada(null); }
  function cortarConCarta(carta) { socket.emit("chinchon:cortar", { carta }); setCartaSeleccionada(null); }

  if (finPartida) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D1F14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Work Sans', sans-serif", gap: 18 }}>
        <h2 style={{ color: finPartida.gane ? "#C9A227" : "#8B2E2E", fontFamily: "'Fraunces', serif", fontSize: 32 }}>
          {finPartida.gane ? "¡Ganaste la partida!" : "Perdiste esta partida"}
        </h2>
        {finPartida.motivo && <p style={{ color: "#B7AA88" }}>{finPartida.motivo}</p>}
        <button onClick={onSalirMesa} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: "#C9A227", color: "#1B3A2C", fontWeight: 700, cursor: "pointer" }}>
          Volver al lobby
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1F14", fontFamily: "'Work Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=IBM+Plex+Mono:wght@500;600&display=swap');`}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px" }}>
        <button onClick={onSalirMesa} style={{ background: "none", border: "none", color: "#5C6E62", cursor: "pointer", fontSize: 13 }}>
          ← Abandonar
        </button>
        <div style={{ display: "flex", gap: 24, alignItems: "center", fontFamily: "'IBM Plex Mono', monospace" }}>
          <Marcador nombre={usuario.nombre} puntos={idxPropio === null ? puntos[1] : puntos[idxPropio]} activo />
          <span style={{ color: "#4A6350", fontSize: 20 }}>—</span>
          <Marcador nombre="Rival" puntos={idxPropio === null ? puntos[0] : puntos[1 - idxPropio]} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#C9A227", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14 }}>
          ● {apuesta} en juego
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <p style={{ color: esMiTurno ? "#C9A227" : "#5C6E62", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: "0.08em" }}>
          {esMiTurno ? (fase === "robar" ? "TU TURNO · ROBÁ UNA CARTA" : "TU TURNO · DESCARTÁ O CORTÁ") : "TURNO DEL RIVAL"}
        </p>

        <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
          {/* Mazo */}
          <div style={{ textAlign: "center" }}>
            <div onClick={() => esMiTurno && fase === "robar" && robarMazo()} style={{ cursor: esMiTurno && fase === "robar" ? "pointer" : "default" }}>
              <CartaDorso />
            </div>
            <p style={{ color: "#5C6E62", fontSize: 11, marginTop: 6 }}>Mazo</p>
          </div>

          {/* Rival */}
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: cartasRivalRestantes }).map((_, i) => <CartaDorso key={i} />)}
          </div>

          {/* Pozo */}
          <div style={{ textAlign: "center" }}>
            <div onClick={() => esMiTurno && fase === "robar" && robarPozo()} style={{ cursor: esMiTurno && fase === "robar" ? "pointer" : "default" }}>
              {pozo.length > 0 ? <CartaMini {...pozo[pozo.length - 1]} /> : <div style={{ width: 52, height: 74 }} />}
            </div>
            <p style={{ color: "#5C6E62", fontSize: 11, marginTop: 6 }}>Pozo</p>
          </div>
        </div>

        {mensaje && (
          <div style={{ color: "#C9A227", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>
            {mensaje}
          </div>
        )}
      </div>

      <footer style={{ padding: "20px 28px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {manoJugador.map((c, i) => (
            <div
              key={i}
              onClick={() => setCartaSeleccionada(c)}
              style={{
                cursor: "pointer",
                transform: cartaSeleccionada === c ? "translateY(-10px)" : "none",
                transition: "transform 0.15s",
              }}
            >
              <CartaMini numero={c.numero} palo={c.palo} />
            </div>
          ))}
        </div>

        {esMiTurno && fase === "descartar" && cartaSeleccionada && (
          <div style={{ display: "flex", gap: 10 }}>
            <BotonAccion label="Descartar esta carta" destacado onClick={() => descartarCarta(cartaSeleccionada)} />
            <BotonAccion label="Cortar con esta carta" onClick={() => cortarConCarta(cartaSeleccionada)} />
          </div>
        )}
      </footer>
    </div>
  );
}


/* ---------------- PANTALLA: PERFIL (editar nombre y avatar) ---------------- */

function PantallaPerfil({ usuario, token, onVolver, onActualizado }) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [avatarId, setAvatarId] = useState(usuario.avatarId ?? 0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setError("");
    if (nombre.trim().length < 2) {
      setError("El nombre tiene que tener al menos 2 caracteres.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/perfil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: nombre.trim(), avatarId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        setGuardando(false);
        return;
      }
      onActualizado(data.usuario);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1800);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setGuardando(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#16301F", fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=IBM+Plex+Mono:wght@600&display=swap');`}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid #23422F" }}>
        <button onClick={onVolver} style={{ background: "none", border: "none", color: "#5C6E62", cursor: "pointer", fontSize: 13 }}>
          ← Volver al lobby
        </button>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, color: "#EDE4D2", margin: 0 }}>
          Tu perfil
        </h1>
        <div style={{ width: 100 }} />
      </header>

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px", textAlign: "center" }}>
        <AvatarIcon avatarId={avatarId} size={88} />

        <div style={{ marginTop: 24, marginBottom: 32 }}>
          <label style={{ display: "block", color: "#B7AA88", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
            Nombre para mostrar
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={30}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10,
              border: "1.5px solid #3A5A47", background: "#1B3A2C", color: "#EDE4D2",
              fontFamily: "'Work Sans', sans-serif", fontSize: 16, textAlign: "center",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <p style={{ color: "#B7AA88", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'IBM Plex Mono', monospace" }}>
          Elegí tu avatar
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
          {AVATAR_SET.map((_, i) => (
            <button
              key={i}
              onClick={() => setAvatarId(i)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 6,
                borderRadius: "50%",
                outline: avatarId === i ? "2.5px solid #C9A227" : "2.5px solid transparent",
                outlineOffset: 2,
                transition: "outline 0.15s",
              }}
            >
              <AvatarIcon avatarId={i} size={52} />
            </button>
          ))}
        </div>

        {error && <p style={{ color: "#D97757", fontSize: 13, marginBottom: 16 }}>{error}</p>}
        {guardado && <p style={{ color: "#C9A227", fontSize: 13, marginBottom: 16 }}>Guardado ✓</p>}

        <button
          onClick={guardar}
          disabled={guardando}
          style={{
            padding: "13px 40px", borderRadius: 10, border: "none",
            background: "#C9A227", color: "#1B3A2C", fontWeight: 700, fontSize: 15,
            cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.7 : 1,
            boxShadow: "0 6px 14px rgba(201,162,39,0.35)",
          }}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </main>
    </div>
  );
}


export default function TrucoCheApp() {
  const sesionGuardada = leerSesion();
  const [pantalla, setPantalla] = useState(sesionGuardada ? "lobby" : "auth");
  const [usuario, setUsuario] = useState(sesionGuardada?.usuario || null);
  const [token, setToken] = useState(sesionGuardada?.token || null);
  const [apuesta, setApuesta] = useState(50);
  const [juego, setJuego] = useState("truco"); // 'truco' | 'chinchon'
  const [socket, setSocket] = useState(null);
  const [estadoInicial, setEstadoInicial] = useState(null);
  const [errorGlobal, setErrorGlobal] = useState("");

  function ingresar(usuarioNuevo, tokenNuevo) {
    setUsuario(usuarioNuevo);
    setToken(tokenNuevo);
    setPantalla("lobby");
  }

  function salir() {
    borrarSesion();
    if (socket) socket.disconnect();
    setSocket(null);
    setUsuario(null);
    setToken(null);
    setPantalla("auth");
  }

  function entrarABuscar(apuestaElegida, juegoElegido) {
    setApuesta(apuestaElegida);
    setJuego(juegoElegido);
    setErrorGlobal("");

    // Se crea la conexión de socket recién acá (no antes), autenticada con el JWT.
    const nuevoSocket = io(BACKEND_SOCKET_URL, { auth: { token } });
    nuevoSocket.on("connect_error", (err) => {
      setErrorGlobal("No se pudo conectar al servidor de partidas: " + err.message);
      setPantalla("lobby");
    });
    setSocket(nuevoSocket);
    setPantalla("buscando");
  }

  function partidaEncontrada(estado) {
    setEstadoInicial(estado);
    setPantalla("mesa");
  }

  function cancelarBusqueda() {
    if (socket) socket.disconnect();
    setSocket(null);
    setPantalla("lobby");
  }

  function salirDeMesa() {
    if (socket) socket.disconnect();
    setSocket(null);
    setEstadoInicial(null);
    setPantalla("lobby");
  }

  if (pantalla === "auth") {
    return <PantallaAuth onIngresar={ingresar} />;
  }
  if (pantalla === "lobby") {
    return (
      <>
        {errorGlobal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#8B2E2E", color: "#EDE4D2", textAlign: "center", padding: 10, fontFamily: "'Work Sans', sans-serif", fontSize: 13, zIndex: 10 }}>
            {errorGlobal}
          </div>
        )}
        <PantallaLobby usuario={usuario} token={token} onEntrarMesa={entrarABuscar} onSalir={salir} onVerRanking={() => setPantalla("ranking")} onVerPerfil={() => setPantalla("perfil")} />
      </>
    );
  }
  if (pantalla === "ranking") {
    return <PantallaRanking usuario={usuario} token={token} onVolver={() => setPantalla("lobby")} />;
  }
  if (pantalla === "perfil") {
    return (
      <PantallaPerfil
        usuario={usuario}
        token={token}
        onVolver={() => setPantalla("lobby")}
        onActualizado={(usuarioActualizado) => {
          setUsuario(usuarioActualizado);
          guardarSesion(token, usuarioActualizado); // persiste el cambio para la próxima vez que entre
        }}
      />
    );
  }
  if (pantalla === "buscando") {
    return (
      <PantallaBuscando
        usuario={usuario}
        socket={socket}
        apuesta={apuesta}
        juego={juego}
        onEncontrado={partidaEncontrada}
        onCancelar={cancelarBusqueda}
        onError={(msg) => { setErrorGlobal(msg); cancelarBusqueda(); }}
      />
    );
  }
  if (juego === "chinchon") {
    return (
      <PantallaMesaChinchon
        usuario={usuario}
        socket={socket}
        apuesta={apuesta}
        estadoInicial={estadoInicial}
        onSalirMesa={salirDeMesa}
      />
    );
  }
  return (
    <PantallaMesa
      usuario={usuario}
      socket={socket}
      apuesta={apuesta}
      estadoInicial={estadoInicial}
      onSalirMesa={salirDeMesa}
    />
  );
}
