import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'
import Pino from 'pino'

const sesiones = {}

async function iniciarBaileys() {
    console.log('🚀 Bot de Pie Consalud iniciado...\n')

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

    // ✅ CORREGIDO (sin espacio raro)
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Pie Consalud Bot', 'Chrome', '1.0']
    })

    // 🔹 CONEXIÓN
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

        const mensaje = text.toLowerCase().trim()
        let respuesta = ''

        // ==============================
        // SELECCIÓN DE SUCURSAL
        // ==============================

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

        // ==============================
        // ABONO
        // ==============================

        else if (mensaje === '4' || mensaje.includes('abono')) {

            if (!sesiones[from]?.sucursal) {
                respuesta =
`Para enviarte los datos de abono, primero indícanos la sucursal:

Escribe:
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

Abono: *$10.000*  
Se descuenta del total de la atención.

⚠️ Sin aviso previo, el abono no es reembolsable.`
            }

            else {
                respuesta =
`💳 *Datos de Abono – Sucursal Providencia*

Banco Chile  
Cuenta Vista  
N° 000083725182  
Rut: 77.478.206-0  
Correo: Pieconsalud@gmail.com  

Abono: *$10.000*  
Se descuenta del total de la atención.

⚠️ Sin aviso previo, el abono no es reembolsable.`
            }
        }

        // ==============================
        // RESERVA
        // ==============================

        else if (mensaje === '1' || mensaje.includes('hora') || mensaje.includes('reservar')) {
            respuesta =
`📅 *Reserva de Hora*

Selecciona tu sucursal y revisa disponibilidad en línea:

🏙️ Ahumada  
https://calendly.com/pieconsalud-santiagocentro/reserva-tu-hora

🏙️ Providencia  
https://calendly.com/pieconsalud-providencia/reserva-tu-hora

⚠️ Importante: asistir sin esmalte.
De lo contrario se aplicará un cobro adicional.`
        }

        // ==============================
        // PRECIOS
        // ==============================

        else if (mensaje === '2' || mensaje.includes('precio')) {
            respuesta =
`🏷️ *Valores de Atención – Pie Consalud*

Atención Podológica: *$20.000*

Tratamientos como:
• Uña encarnada  
• Onicomicosis  
• Pie diabético  

El valor puede variar según evaluación profesional.`
        }

        // ==============================
        // UBICACIÓN
        // ==============================

        else if (mensaje === '3' || mensaje.includes('direccion') || mensaje.includes('ubicacion')) {
            respuesta =
`📍 *Nuestras Sucursales*

🏙️ Ahumada  
Cerca de Metro U. de Chile / Plaza de Armas

🏙️ Providencia  
Cerca de Metro Tobalaba

Escribe el nombre de la sucursal para continuar.`
        }

        // ==============================
        // HORARIOS
        // ==============================

        else if (mensaje === '5' || mensaje.includes('horario')) {
            respuesta =
`🕒 *Horario de Atención*

Lunes a viernes  
10:00 a 17:00 hrs  
Sábados de 10:00 a 12:00`
        }

        // ==============================
        // MEDIOS DE PAGO
        // ==============================

        else if (mensaje === '6' || mensaje.includes('pago')) {
            respuesta =
`💰 *Medios de Pago*

✔️ Transferencia electrónica  
✔️ Efectivo  

El abono de $10.000 se realiza vía transferencia al momento de agendar.`
        }

        // ==============================
        // MENÚ PRINCIPAL
        // ==============================

        else {
            respuesta =
`👣 *¡Hola! Bienvenido/a a Pie Consalud* 👣

Muchas gracias por escribirnos 😊  
Será un gusto ayudarte.

Por favor indícanos el número de la opción que necesitas:

1️⃣ Reservar una hora  
2️⃣ Ver precios y servicios  
3️⃣ Ubicación de nuestras sucursales  
4️⃣ Datos para realizar el abono  
5️⃣ Horarios de atención  
6️⃣ Medios de pago aceptados`
        }

        await sock.sendMessage(from, { text: respuesta })
    })

    sock.ev.on('creds.update', saveCreds)
}

iniciarBaileys()


