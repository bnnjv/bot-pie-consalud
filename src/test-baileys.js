import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import Pino from 'pino'
import express from 'express'

const sesiones = {}

async function iniciarBaileys() {

    console.log('🚀 Bot de Pie Consalud iniciado...\n')

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Pie Consalud Bot', 'Chrome', '1.0']
    })

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
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔁 Reintentando conexión...')
                iniciarBaileys()
            }
        }

    })

    sock.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        const mensaje = text.toLowerCase().trim()

        let respuesta = ''

        if (mensaje === 'ahumada') {
            sesiones[from] = { sucursal: 'ahumada' }

            respuesta =
`✅ Has seleccionado la sucursal *Ahumada*.

Ahora puedes escribir:
4️⃣ Para recibir los datos de abono
1️⃣ Para reservar tu hora`
        }

        else if (mensaje === 'providencia') {

            sesiones[from] = { sucursal: 'providencia' }

            respuesta =
`✅ Has seleccionado la sucursal *Providencia*.

Ahora puedes escribir:
4️⃣ Para recibir los datos de abono
1️⃣ Para reservar tu hora`
        }

        else if (mensaje === '4' || mensaje.includes('abono')) {

            if (!sesiones[from]?.sucursal) {

                respuesta =
`Para enviarte los datos de abono primero indícanos la sucursal:

• Ahumada
• Providencia`
            }

            else if (sesiones[from].sucursal === 'ahumada') {

                respuesta =
`💳 *Datos de Abono – Sucursal Ahumada*

Banco Estado
Cuenta Corriente
N° 29100119011
Rut: 77.478.206-0
Correo: Piesalud.21@gmail.com

Abono: *$10.000*`
            }

            else {

                respuesta =
`💳 *Datos de Abono – Sucursal Providencia*

Banco Chile
Cuenta Vista
N° 000083725182
Rut: 77.478.206-0
Correo: Pieconsalud@gmail.com

Abono: *$10.000*`
            }
        }

        else if (mensaje === '1' || mensaje.includes('hora') || mensaje.includes('reservar')) {

            respuesta =
`📅 *Reserva de Hora*

Ahumada
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

Providencia
https://calendly.com/pieconsalud-providencia/reserva-tu-hora`
        }

        else if (mensaje === '2' || mensaje.includes('precio')) {

            respuesta =
`🏷️ *Valores de Atención*

Atención Podológica: *$20.000*

Tratamientos especiales pueden variar según evaluación.`
        }

        else if (mensaje === '3' || mensaje.includes('ubicacion') || mensaje.includes('direccion')) {

            respuesta =
`📍 *Nuestras sucursales*

🏙️ Ahumada
Cerca de Metro U. de Chile

🏙️ Providencia
Cerca de Metro Tobalaba

Escribe el nombre de la sucursal.`
        }

        else if (mensaje === '5' || mensaje.includes('horario')) {

            respuesta =
`🕒 *Horario de atención*

Lunes a viernes
10:00 a 17:00

Sábados
10:00 a 12:00`
        }

        else if (mensaje === '6' || mensaje.includes('pago')) {

            respuesta =
`💰 *Medios de pago*

✔ Transferencia
✔ Efectivo`
        }

        else {

            respuesta =
`👣 *Bienvenido a Pie Consalud*

Indica el número de la opción:

1️⃣ Reservar hora
2️⃣ Ver precios
3️⃣ Ubicación
4️⃣ Datos de abono
5️⃣ Horarios
6️⃣ Medios de pago`
        }

        await sock.sendMessage(from, { text: respuesta })

    })

    sock.ev.on('creds.update', saveCreds)
}

const app = express()
const PORT = process.env.PORT || 3000

app.all('/', (req, res) => {
    res.status(200).send('Bot Pie Consalud Online')
})

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Servidor web activo en puerto', PORT)
    iniciarBaileys()
})
