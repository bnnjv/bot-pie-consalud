import express from "express"
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState
} from "@whiskeysockets/baileys"

import Pino from "pino"
import QRCode from "qrcode"

// servidor express para Railway
const app = express()
const PORT = process.env.PORT || 8080

app.get("/", (req, res) => {
    res.send("Bot Online")
})

app.listen(PORT, () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`)
})

// iniciar bot
async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth_info")

    const sock = makeWASocket({
        logger: Pino({ level: "silent" }),
        auth: state,
        browser: ["Bot Consalud", "Chrome", "1.0.0"]
    })

    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect, qr } = update

        // QR
        if (qr) {

            console.log("\n📲 ESCANEA ESTE QR\n")

            const qrTerminal = await QRCode.toString(qr, {
                type: "terminal",
                small: true
            })

            console.log(qrTerminal)

            const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`

            console.log("\n🌐 Abre este link para escanear el QR:")
            console.log(qrLink)
        }

        // conexión abierta
        if (connection === "open") {
            console.log("✅ WhatsApp conectado correctamente")
        }

        // conexión cerrada
        if (connection === "close") {

            const reason = lastDisconnect?.error?.output?.statusCode

            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {

                console.log("🔁 Reconectando en 5 segundos...")

                setTimeout(() => {
                    iniciarBot()
                }, 5000)

            } else {
                console.log("⚠️ Sesión cerrada. Borra la carpeta auth_info para volver a escanear QR.")
            }
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

console.log("🚀 Bot de Pie Consalud iniciando...")

iniciarBot()