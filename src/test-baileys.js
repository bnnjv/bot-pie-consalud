import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'
import Pino from 'pino'

// 🔹 Memoria simple de usuarios
const sesiones = {}

async function iniciarBaileys() {
    console.log('🚀 Bot de Pie Consalud iniciado...\n')

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Pie Consalud Bot', 'Chrome', '1.0']
    })

    // 🔹 CONEXIÓN (NO SE TOCA EL QR)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

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
            if (reason !== DisconnectReason.loggedOut) {
                iniciarBaileys()
            }
        }
    })

    // 🔹 MENSAJES
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ''

        const mensaje = text.toLowerCase()

        // 🌱 MENSAJE INICIAL
        let respuesta =
`👣 *¡Hola! Bienvenido/a a Pie Consalud* 👣

Muchas gracias por escribirnos 😊  
¿En qué podemos ayudarte hoy?

Responde con el número de la opción que necesites:

1️⃣ Reservar una hora  
2️⃣ Ver precios y servicios  
3️⃣ Ubicación de nuestras sucursales  
4️⃣ Datos para realizar el abono  
5️⃣ Horarios de atención  
6️⃣ Medios de pago aceptados`

        // 2️⃣ PRECIOS
        if (mensaje.includes('precio') || mensaje === '2') {
            respuesta =
`🏷️ *Valores de Atención – Pie Consalud*

La atención de Podología tiene un valor de *$20.000*.

Tratamientos específicos pueden variar según evaluación profesional.

¿Te gustaría agendar una hora?`
        }

        // 3️⃣ UBICACIÓN
        else if (mensaje.includes('direccion') || mensaje.includes('ubicacion') || mensaje === '3') {
            respuesta =
`📍 *Nuestras Sucursales*

🏙️ *Ahumada*  
Cerca de Metro U. de Chile / Plaza de Armas  

🏙️ *Providencia*  
Cerca de Metro Tobalaba  

¿En cuál sucursal deseas atenderte?`
        }

        // 🔹 GUARDAR SUCURSAL
        else if (mensaje === 'ahumada' || mensaje === '1 ahumada') {
            sesiones[from] = { sucursal: 'ahumada' }
            respuesta = '✅ Sucursal Ahumada seleccionada.'
        }

        else if (mensaje === 'providencia' || mensaje === '2 providencia') {
            sesiones[from] = { sucursal: 'providencia' }
            respuesta = '✅ Sucursal Providencia seleccionada.'
        }

        // 1️⃣ RESERVA
        else if (mensaje.includes('hora') || mensaje.includes('reservar') || mensaje === '1') {
            respuesta =
`📅 *Reserva de Hora*

🏙️ Ahumada  
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

🏙️ Providencia  
https://calendly.com/pieconsalud-providencia/reserva-tu-hora

⚠️ Asistir sin esmalte.`
        }

        // 4️⃣ ABONO (MEJORADO)
        else if (mensaje.includes('abono') || mensaje.includes('transferencia') || mensaje === '4') {

            if (!sesiones[from]?.sucursal) {
                respuesta =
`Para enviarte los datos de abono, indícanos la sucursal:

1️⃣ Ahumada  
2️⃣ Providencia`
            }

            else if (sesiones[from].sucursal === 'ahumada') {
                respuesta =
`💳 *Datos de Abono – Sucursal Ahumada*

Banco Estado  
Cuenta Corriente  
N° 29100119011  
Rut: 77.478.206-0  
Correo: Piesalud.21@gmail.com

Abono: $10.000`
            }

            else if (sesiones[from].sucursal === 'providencia') {
                respuesta =
`💳 *Datos de Abono – Sucursal Providencia*

Banco Chile  
Cuenta Vista  
N° 000083725182  
Rut: 77.478.206-0  
Correo: Pieconsalud@gmail.com

Abono: $10.000`
            }
        }

        // 5️⃣ HORARIO
        else if (mensaje.includes('horario') || mensaje === '5') {
            respuesta =
`🕒 *Horario de Atención*

Lunes a Viernes  
10:00 a 17:00 hrs`
        }

        // 6️⃣ MEDIOS DE PAGO
        else if (mensaje.includes('pago') || mensaje === '6') {
            respuesta =
`💰 *Medios de Pago*

✔️ Transferencia  
✔️ Efectivo`
        }

        await sock.sendMessage(from, { text: respuesta })
    })

    sock.ev.on('creds.update', saveCreds)
}

iniciarBaileys()



