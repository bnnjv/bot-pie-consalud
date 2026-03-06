import express from "express"
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import Pino from "pino"
import QRCode from "qrcode"

const app = express()
const PORT = process.env.PORT || 8080

app.get("/", (req, res) => {
    res.send("Bot Online")
})

app.listen(PORT, () => {
    console.log("🌐 Servidor web activo en puerto " + PORT)
})

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth_info")

    // 🔹 obtiene versión correcta de WhatsApp
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: Pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    })

    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect, qr } = update

        if (qr) {

            console.log("\n📲 ESCANEA ESTE QR\n")

            const qrImage = await QRCode.toString(qr, {
                type: "terminal",
                small: true
            })

            console.log(qrImage)
        }

        if (connection === "open") {
            console.log("✅ WhatsApp conectado")
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
                console.log("⚠️ Sesión cerrada")
            }
        }
    })

    sock.ev.on("creds.update", saveCreds)
}

console.log("🚀 Bot de Pie Consalud iniciando...")

iniciarBot()