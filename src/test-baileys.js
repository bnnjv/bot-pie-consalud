import express from "express"
import baileys from "@whiskeysockets/baileys"
import Pino from "pino"

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = baileys

const app = express()

const PORT = process.env.PORT || 8080

app.get("/", (req, res) => {
    res.send("Bot Online")
})

app.listen(PORT, () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`)
})

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth_info")

    const sock = makeWASocket({
        logger: Pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: true
    })

    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect, qr } = update

        if (qr) {

            console.log("\n📲 Escanea el QR o usa este link:\n")

            const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`

            console.log(qrLink + "\n")
        }

        if (connection === "open") {
            console.log("✅ WhatsApp conectado correctamente")
        }

        if (connection === "close") {

            const reason = lastDisconnect?.error?.output?.statusCode

            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {

                console.log("🔁 Reconectando en 5 segundos...")

                setTimeout(() => iniciarBot(), 5000)

            } else {
                console.log("⚠️ Sesión cerrada. Borra auth_info para volver a escanear QR.")
            }
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

console.log("🚀 Bot de Pie Consalud iniciando...\n")

iniciarBot()