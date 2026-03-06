import express from "express"
import baileys from "@whiskeysockets/baileys"
import Pino from "pino"
import fs from "fs"
import path from "path"
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8080

// Servidor web mejorado con logs
app.use((req, res) => {
    console.log(`🌐 Healthcheck: ${req.method} ${req.url}`)
    res.status(200).send("Bot Online")
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor web en puerto ${PORT}`)
})

// Log del entorno
console.log("🔧 Node version:", process.version)
console.log("📁 Directorio:", process.cwd())
console.log("📦 Versión Baileys:", baileys)

// Extraer makeWASocket correctamente
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    Browsers 
} = baileys

// Función para limpiar TODO
function limpiarTodo() {
    const carpetas = [
        "./auth_info",
        "./auth_info_baileys",
        "./session",
        "./.auth"
    ]
    
    carpetas.forEach(carpeta => {
        const ruta = path.join(process.cwd(), carpeta)
        if (fs.existsSync(ruta)) {
            console.log(`🧹 Eliminando: ${carpeta}`)
            fs.rmSync(ruta, { recursive: true, force: true })
        }
    })
}

async function iniciarBot() {
    console.log("\n🚀 Iniciando bot...")
    
    // Limpiar siempre al inicio por ahora
    limpiarTodo()
    
    try {
        console.log("📁 Creando carpeta auth_info...")
        fs.mkdirSync("./auth_info", { recursive: true })
        
        console.log("🔐 Obteniendo estado de autenticación...")
        const { state, saveCreds } = await useMultiFileAuthState("./auth_info")
        
        console.log("🔌 Creando socket...")
        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: "debug" }), // Cambiado a debug para ver más
            browser: Browsers.appropriate("Pie Consalud"),
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            // Opciones de conexión
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            defaultQueryTimeoutMs: 60000,
            version: [2, 3000, 1015901307] // Versión específica de WhatsApp
        })

        console.log("✅ Socket creado, esperando eventos...")

        sock.ev.on("connection.update", (update) => {
            console.log("📡 Evento connection.update:", Object.keys(update))
            
            const { connection, lastDisconnect, qr, isNewLogin } = update

            if (qr) {
                console.log("\n========== QR GENERADO ==========")
                console.log(qr)
                console.log("===================================")
                
                const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
                console.log("\n📲 O escanea aquí:")
                console.log(qrLink)
                console.log("")
            }

            if (isNewLogin) {
                console.log("✅ Nuevo login exitoso")
            }

            if (connection === "open") {
                console.log("🎉 ¡CONECTADO A WHATSAPP!")
            }

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const error = lastDisconnect?.error
                
                console.log("❌ Conexión cerrada")
                console.log("Código:", statusCode)
                console.log("Error completo:", error)
                
                if (statusCode === 405) {
                    console.log("⚠️ Error 405 - Problema de autenticación")
                    setTimeout(() => iniciarBot(), 5000)
                } else {
                    setTimeout(() => iniciarBot(), 5000)
                }
            }
        })

        sock.ev.on("creds.update", saveCreds)
        
        // Evento adicional para debug
        sock.ev.on("messages.upsert", () => {})
        
        console.log("🎧 Escuchando eventos...")
        
    } catch (error) {
        console.error("💥 Error crítico:", error)
        setTimeout(() => iniciarBot(), 5000)
    }
}

// Ejecutar
console.log("🏁 Iniciando aplicación...")
iniciarBot()