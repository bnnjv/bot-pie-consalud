import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'
import Pino from 'pino'
import express from 'express'

const sesiones = {}

async function iniciarBaileys() {
    console.log('🚀 Bot de Pie Consalud iniciado...\n')

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_2')

    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Pie Consalud Bot', 'Chrome', '1.0'],
        printQRInTerminal: false,
        syncFullHistory: false
    })

    // ==============================
    // CONEXIÓN
    // ==============================

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            const link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
            console.log('\n📲 ESCANEA ESTE QR:')
            console.log(link + '\n')
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp conectado correctamente')
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            console.log('❌ Conexión cerrada. Código:', reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log('⚠️ Sesión cerrada. Borra la carpeta auth_info y vuelve a escanear.')
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)

    // ==============================
    // MENSAJES
    // ==============================

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ''

        const mensaje = text.toLowerCase().trim()
        let respuesta = ''

        if (mensaje === 'ahumada') {
            sesiones[from] = { sucursal: 'ahumada' }
            respuesta =
`✅ Has seleccionado la sucursal Ahumada.

Escribe:
4️⃣ Para datos de abono
1️⃣ Para reservar hora`
        }

        else if (mensaje === 'providencia') {
            sesiones[from] = { sucursal: 'providencia' }
            respuesta =
`✅ Has seleccionado la sucursal Providencia.

Escribe:
4️⃣ Para datos de abono
1️⃣ Para reservar hora`
        }

        else if (mensaje === '1') {
            respuesta =
`📅 Reserva tu hora:

Ahumada:
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

Providencia:
https://calendly.com/pieconsalud-providencia/reserva-tu-hora`
        }

        else if (mensaje === '2') {
            respuesta =
`🏷️ Atención Podológica: $20.000

El valor puede variar según evaluación.`
        }

        else if (mensaje === '3') {
            respuesta =
`📍 Sucursales:

Ahumada
Providencia

Escribe el nombre para continuar.`
        }

        else if (mensaje === '4') {

            if (!sesiones[from]?.sucursal) {
                respuesta = `Primero escribe la sucursal: Ahumada o Providencia`
            }

            else if (sesiones[from].sucursal === 'ahumada') {
                respuesta =
`💳 Datos Abono Ahumada

Banco Estado
Cuenta Corriente
29100119011
Rut 77.478.206-0
Abono $10.000`
            }

            else {
                respuesta =
`💳 Datos Abono Providencia

Banco Chile
Cuenta Vista
000083725182
Rut 77.478.206-0
Abono $10.000`
            }
        }

        else if (mensaje === '5') {
            respuesta =
`🕒 Horarios:
Lunes a viernes 10:00 a 17:00
Sábado 10:00 a 12:00`
        }

        else if (mensaje === '6') {
            respuesta =
`💰 Medios de pago:
Transferencia
Efectivo`
        }

        else {
            respuesta =
`👣 Bienvenido a Pie Consalud 👣

1️⃣ Reservar hora
2️⃣ Ver precios
3️⃣ Ubicación
4️⃣ Datos de abono
5️⃣ Horarios
6️⃣ Medios de pago`
        }

        await sock.sendMessage(from, { text: respuesta })
    })
}

// ==============================
// SERVIDOR WEB (RAILWAY)
// ==============================

const app = express()
const PORT = process.env.PORT || 8080

app.get('/', (req, res) => {
    res.send('Bot Pie Consalud Online ✅')
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor web activo en puerto', PORT)
})

iniciarBaileys() // <-- Fuera de las llaves para que corran en paralelo

