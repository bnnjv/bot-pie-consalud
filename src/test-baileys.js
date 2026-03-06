import express from "express"
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState
} from "@whiskeysockets/baileys"

import Pino from "pino"
import QRCode from "qrcode"

const app = express()

// puerto Railway
const PORT = process.env.PORT || 8080

// ruta healthcheck Railway
app.get("/", (req, res) => {
    res.status(200).send("Bot Online")
})

app.listen(PORT, () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`)
})

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth_info")

    const sock = makeWASocket({
        logger: Pino({ level: "silent" }),
        auth: state,

        // 🔧 FIX ERROR 405
        browser: ["Ubuntu", "Chrome", "20.0.04"],

        printQRInTerminal: false
    })

    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect, qr } = update

        if (qr) {

            console.log("\n📲 ESCANEA ESTE QR:\n")

            const qrTerminal = await QRCode.toString(qr, {
                type: "terminal",
                small: true
            })

            console.log(qrTerminal)
        }

        if (connection === "open") {
            console.log("✅ WhatsApp conectado correctamente")
        }

        if (connection === "close") {

            const reason = lastDisconnect?.error?.output?.statusCode

            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {

                console.log("🔁 Reconectando en 5 segundos...")

                setTimeout(() => {
                    iniciarBot()
                }, 5000)

            } else {

                console.log("⚠️ Sesión cerrada. Borra auth_info para volver a escanear QR.")
            }
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

console.log("🚀 Bot de Pie Consalud iniciando...\n")

iniciarBot()