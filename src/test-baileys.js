import express from "express"
import pino from "pino"
import fs from "fs"
import path from "path"
import { fileURLToPath } from 'url'
// La forma más directa para Baileys 6.5.0
import baileys from "@whiskeysockets/baileys"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8080

// Extraer lo que necesitamos
const makeWASocket = baileys.default
const { useMultiFileAuthState, DisconnectReason } = baileys

// Log para debug
console.log("🔧 Contenido de baileys:", Object.keys(baileys))
console.log("🔧 makeWASocket type:", typeof makeWASocket)

// Estado global
let qrCode = null
let connectionStatus = 'desconectado'
let reintentos = 0

// Servidor web
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Bot WhatsApp Pie Consalud</title>
                <style>
                    body { font-family: Arial; padding: 20px; text-align: center; }
                    .qr { margin: 20px; padding: 20px; border: 2px solid #ccc; }
                    .status { padding: 10px; margin: 10px; border-radius: 5px; }
                    .conectado { background: #d4edda; color: #155724; }
                    .desconectado { background: #f8d7da; color: #721c24; }
                    .esperando { background: #fff3cd; color: #856404; }
                </style>
                <meta http-equiv="refresh" content="5">
            </head>
            <body>
                <h1>🤖 Bot WhatsApp - Pie Consalud</h1>
                <div class="status ${connectionStatus === 'conectado' ? 'conectado' : connectionStatus === 'esperando' ? 'esperando' : 'desconectado'}">
                    <h3>Estado: ${connectionStatus}</h3>
                    <p>Reintentos: ${reintentos}</p>
                </div>
                ${qrCode ? `
                    <div class="qr">
                        <h3>📲 Escanea este código QR</h3>
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}" />
                        <p>El QR expira en 20 segundos. Ten el teléfono listo!</p>
                    </div>
                ` : connectionStatus !== 'conectado' ? 
                    '<p>⏳ Generando QR, espera...</p>' : 
                    '<p>✅ Bot conectado!</p>'
                }
            </body>
        </html>
    `)
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor web: http://localhost:${PORT}`)
})

// Función para limpiar sesión
function limpiarSesion() {
    const authPath = path.join(process.cwd(), "auth_info")
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true })
    }
    console.log("🧹 Sesión limpiada")
}

async function iniciarBot() {
    try {
        console.log("\n🚀 Iniciando bot...")
        
        // Verificar que makeWASocket existe antes de continuar
        if (typeof makeWASocket !== 'function') {
            console.error("❌ ERROR CRÍTICO: makeWASocket no es una función")
            console.log("makeWASocket es:", makeWASocket)
            console.log("Tipo:", typeof makeWASocket)
            console.log("Contenido de baileys:", baileys)
            return setTimeout(iniciarBot, 5000)
        }
        
        // Limpiar sesión si hay muchas reconexiones
        if (reintentos > 3) {
            limpiarSesion()
            reintentos = 0
        }
        
        connectionStatus = 'esperando'
        
        // Asegurar carpeta auth
        fs.mkdirSync("./auth_info", { recursive: true })
        
        // Configurar autenticación
        console.log("🔐 Obteniendo estado de autenticación...")
        const { state, saveCreds } = await useMultiFileAuthState("auth_info")
        
        // Crear socket
        console.log("🔌 Creando socket...")
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'error' }),
            browser: ["Pie Consalud", "Chrome", "1.0"],
            printQRInTerminal: true,
            syncFullHistory: false,
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 30000
        })
        
        console.log("✅ Socket creado, esperando eventos...")
        
        // Manejar eventos
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                qrCode = qr
                console.log("\n" + "=".repeat(50))
                console.log("📲 QR GENERADO - ESCANEA AHORA!")
                console.log("=".repeat(50))
                console.log(`Link: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`)
                console.log("=".repeat(50) + "\n")
                
                // El QR expira rápido
                setTimeout(() => {
                    if (connectionStatus !== 'conectado') {
                        console.log("⌛ QR expirado, esperando nuevo...")
                    }
                }, 20000)
            }
            
            if (connection === 'open') {
                console.log("\n✅ ¡CONECTADO A WHATSAPP!\n")
                connectionStatus = 'conectado'
                qrCode = null
                reintentos = 0
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const errorMsg = lastDisconnect?.error?.message || 'desconocido'
                
                console.log(`❌ Conexión cerrada: ${errorMsg} (${statusCode || 'sin código'})`)
                
                if (statusCode === 405 || errorMsg.includes('405')) {
                    console.log("⚠️ Error 405 - limpiando sesión...")
                    limpiarSesion()
                }
                
                connectionStatus = 'desconectado'
                reintentos++
                
                console.log(`🔄 Reintentando en 5s (intento ${reintentos})...`)
                setTimeout(iniciarBot, 5000)
            }
        })
        
        sock.ev.on('creds.update', saveCreds)
        
    } catch (error) {
        console.error("💥 Error en iniciarBot:", error)
        connectionStatus = 'desconectado'
        setTimeout(iniciarBot, 5000)
    }
}

// Iniciar
iniciarBot()