import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'
import Pino from 'pino'

async function iniciarBaileys() {
    console.log('🚀 Bot iniciado y esperando mensajes...\n')

    const { state, saveCreds } = await useMultiFileAuthState('auth_info')

    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Pie Consalud Bot', 'Chrome', '1.0']
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
            console.log('✅ WhatsApp conectado correctamente')
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            console.log('❌ Conexión cerrada. Código:', reason)

            if (reason !== DisconnectReason.loggedOut) {
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
            respuesta =
`🏷️ *Valores Pie Consalud*

El valor de la atención de Podología en Pie Sano es de *$20.000*.

Para tratamientos específicos como uña encarnada, onicomicosis o pie diabético, el valor puede variar según evaluación profesional.

¿Te ayudo a reservar una hora?`
        }

        // HORARIO
        else if (mensaje.includes('horario') || mensaje === '5') {
            respuesta =
`🕒 *Horario de atención*

Atendemos de *lunes a viernes de 10:00 a 17:00 hrs*.

¿Deseas agendar una hora?`
        }

        // DIRECCIÓN
        else if (mensaje.includes('direccion') || mensaje.includes('ubicacion') || mensaje === '3') {
            respuesta =
`📍 *Sucursales Pie Consalud*

🏙️ *Ahumada*  
Cerca del metro U. de Chile / Plaza de Armas  
https://www.google.com/maps/place/Pie+Consalud%2FPodolog%C3%ADa+en+Santiago+Centro

🏙️ *Providencia*  
Cerca del metro Tobalaba  
https://www.google.com/maps/place/Pie+Consalud%2FPodolog%C3%ADa+en+Providencia

¿En cuál deseas atenderte?`
        }

        // RESERVA
        else if (mensaje.includes('hora') || mensaje.includes('reservar') || mensaje === '1') {
            respuesta =
`📅 *Reserva de hora*

Elige tu sucursal:

🏙️ Ahumada  
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

🏙️ Providencia  
https://calendly.com/pieconsalud-providencia/reserva-tu-hora

⚠️ Recuerda asistir *sin esmalte*, de lo contrario se aplicará un cobro adicional.`
        }

        // ABONO
        else if (mensaje.includes('abono') || mensaje.includes('transferencia') || mensaje === '4') {
            respuesta =
`💳 *Abono para reservar hora*

El abono es de *$10.000* y se descuenta del total.

📍 *Ahumada*  
Banco Estado  
Cuenta Vista  
N° 90270812138  
Correo: Piesalud.21@gmail.com  

📍 *Providencia*  
Banco Chile  
Cuenta Vista  
N° 000083725182  
Correo: Pieconsalud@gmail.com  

⚠️ El abono se realiza inmediatamente después de agendar.  
Sin aviso previo, el abono no es reembolsable.`
        }

        await sock.sendMessage(from, { text: respuesta })
    })

    sock.ev.on('creds.update', saveCreds)
}

iniciarBaileys()

