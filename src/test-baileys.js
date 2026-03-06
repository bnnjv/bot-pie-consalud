import express from "express"
import baileys from "@whiskeysockets/baileys"
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys
import Pino from "pino"
import fs from "fs"
import path from "path"

const app = express()
const PORT = process.env.PORT || 8080

// Middleware para healthchecks
app.use((req, res) => {
    res.status(200).send("Bot Online")
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`)
})

// Función para limpiar sesión corrupta
function limpiarSesionCorrupta() {
    const authPath = path.join(process.cwd(), "auth_info")
    if (fs.existsSync(authPath)) {
        console.log("🧹 Limpiando sesión corrupta...")
        fs.rmSync(authPath, { recursive: true, force: true })
        console.log("✅ Sesión eliminada")
    }
}

async function iniciarBot() {
    console.log("🚀 Bot de Pie Consalud iniciando...\n")

    // Verificar si debemos limpiar la sesión
    const deberiaLimpiar = process.env.CLEAN_SESSION === "true" || !fs.existsSync("./auth_info")
    if (deberiaLimpiar) {
        limpiarSesionCorrupta()
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState("./auth_info")

        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: "silent" }),
            browser: ["Pie Consalud Bot", "Chrome", "1.0"],
            // Intentar con opciones adicionales para evitar el 405
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            printQRInTerminal: false
        })

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
                console.log("\n📲 ESCANEA ESTE QR PARA VINCULAR:")
                console.log(qrLink + "\n")
            }

            if (connection === "open") {
                console.log("✅ WhatsApp conectado correctamente")
            }

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const errorMessage = lastDisconnect?.error?.message
                
                console.log("❌ Conexión cerrada - Código:", statusCode, "Mensaje:", errorMessage)

                // Si es error 405 (autenticación) o loggedOut, limpiar sesión
                if (statusCode === 405 || statusCode === DisconnectReason.loggedOut) {
                    console.log("⚠️ Error de autenticación detectado, limpiando sesión...")
                    limpiarSesionCorrupta()
                    console.log("🔄 Reintentando en 3 segundos con sesión limpia...")
                    setTimeout(() => iniciarBot(), 3000)
                } else {
                    console.log("🔁 Reintentando conexión en 5 segundos...")
                    setTimeout(() => iniciarBot(), 5000)
                }
            }
        })

        sock.ev.on("creds.update", saveCreds)
        
        // Guardar sock en global para debug
        global.sock = sock
        
    } catch (error) {
        console.error("Error al iniciar bot:", error)
        setTimeout(() => iniciarBot(), 5000)
    }
}

// Iniciar con sesión limpia forzada por variable de entorno
if (process.env.FORCE_CLEAN === "true") {
    limpiarSesionCorrupta()
}

iniciarBot()