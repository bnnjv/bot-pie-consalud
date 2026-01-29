import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'
import Pino from 'pino'

async function iniciarBaileys() {
    console.log('🚀 Bot iniciado y esperando mensajes...\n')

    // ✅ RUTA PARA RAILWAY
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Pie Consalud Bot', 'Chrome', '1.0']
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        // ✅ ESTO GENERA EL LINK PARA ESCANEAR EN LOS LOGS DE RAILWAY
        if (qr) {
            const link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
            console.log('\n📲 ESCANEA ESTE QR PARA VINCULAR PIE CONSALUD:')
            console.log(link + '\n')
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp conectado correctamente')
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            console.log('❌ Conexión cerrada. Código:', reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log('🔒 Sesión cerrada, debes borrar la carpeta auth_info y volver a escanear')
            } else {
                iniciarBaileys()
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ''

        const mensaje = text.toLowerCase()

        let respuesta = `👣 *Pie Consalud*\nHola 👋 gracias por escribirnos.\n\nResponde con un número:\n1️⃣ Reservar hora\n2️⃣ Precios\n3️⃣ Dirección\n4️⃣ Abono\n5️⃣ Horario`

        // PRECIOS
        if (mensaje.includes('precio') || mensaje === '2') {
            respuesta = `🏷️ *Valores Pie Consalud*\n\nEl valor de la atención de Podología es de *$20.000*.\n\nPara tratamientos específicos (uña encarnada, hongo, pie diabético), el valor varía según evaluación.\n\n¿Te ayudo a reservar?`
        }

        // HORARIO
        else if (mensaje.includes('horario') || mensaje === '5') {
            respuesta = `🕒 *Horario de atención*\n\nLunes a viernes de *10:00 a 17:00 hrs*.\n\n¿Deseas agendar?`
        }

        // DIRECCIÓN
        else if (mensaje.includes('direccion') || mensaje.includes('ubicacion') || mensaje === '3') {
            respuesta = `📍 *Sucursales Pie Consalud*\n\n🏙️ *Ahumada*: Cerca de Metro U. de Chile.\n🏙️ *Providencia*: Cerca de Metro Tobalaba.\n\n¿En cuál deseas atenderte?`
        }

        // RESERVA
        else if (mensaje.includes('hora') || mensaje.includes('reservar') || mensaje === '1') {
            respuesta = `📅 *Reserva de hora*\n\nElige tu sucursal:\n\n🏙️ Ahumada: https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora\n🏙️ Providencia: https://calendly.com/pieconsalud-providencia/reserva-tu-hora\n\n⚠️ Asistir *sin esmalte*.`
        }

        // ABONO
        else if (mensaje.includes('abono') || mensaje.includes('transferencia') || mensaje === '4') {
            respuesta = `💳 *Abono para reservar*\n\nEl abono es de *$10.000* (se descuenta del total).\n\n📍 *Ahumada*: Banco Estado, Vista, N° 90270812138.\n📍 *Providencia*: Banco Chile, Vista, N° 000083725182.\n\n⚠️ Realizar abono inmediatamente después de agendar.`
        }

        await sock.sendMessage(from, { text: respuesta })
    })

    sock.ev.on('creds.update', saveCreds)
}

iniciarBaileys()


