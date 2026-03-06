import express from "express"
import baileys from "@whiskeysockets/baileys"
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys
import Pino from "pino"

const app = express()
const PORT = process.env.PORT || 8080

// Servidor para que Railway esté feliz (Acepta GET y HEAD)
app.all("/", (req, res) => {
    res.status(200).send("Bot Pie Consalud Online ✅")
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`)
})

async function iniciarBot() {
    console.log("🚀 Bot de Pie Consalud iniciando...\n")

    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")

    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: "silent" }),
        browser: ["Pie Consalud Bot", "Chrome", "1.0"]
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
            const reason = lastDisconnect?.error?.output?.statusCode
            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔁 Reintentando conexión en 5 segundos...")
                setTimeout(() => {
                    iniciarBot()
                }, 5000)
            } else {
                console.log("⚠️ Sesión cerrada. Borra auth_info para generar nuevo QR.")
            }
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

iniciarBot()