// =====================
// IMPORTS
// =====================
import { createBot, createFlow, addKeyword } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { JsonFileDB } from '@builderbot/database-json'

// =====================
// FLUJOS
// =====================
const flujoInicio = addKeyword(['hola', 'buenas', 'inicio'])
  .addAnswer('✨ ¡Bienvenido a Pie Consalud! Soy tu asistente virtual.')
  .addAnswer([
    '¿A qué sucursal deseas asistir?',
    '1️⃣ Ahumada',
    '2️⃣ Providencia'
  ])

const flujoAhumada = addKeyword(['1', 'ahumada'])
  .addAnswer([
    '📍 Sucursal Ahumada seleccionada.',
    'Horario: Lunes a Viernes de 9:00 a 18:00.'
  ])

const flujoProvidencia = addKeyword(['2', 'providencia'])
  .addAnswer([
    '📍 Sucursal Providencia seleccionada.',
    'Horario: Lunes a Viernes de 10:00 a 19:00.'
  ])

// =====================
// MAIN
// =====================
const main = async () => {
  // Base de datos JSON
  const adapterDB = new JsonFileDB({
    filename: './db.json'
  })

  // Flujo
  const adapterFlow = createFlow([
    flujoInicio,
    flujoAhumada,
    flujoProvidencia
  ])

  // =====================
  // PROVIDER BAILEYS
  // QR FORZADO POR LINK
  // =====================
  const adapterProvider = new BaileysProvider({
    session: 'session.json',
    qrCallback: async (qr) => {
      const urlFinal =
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`

      console.log('\n==================================================')
      console.log('📲 ESCANEA ESTE QR (COPIA EL LINK EN TU NAVEGADOR):')
      console.log(urlFinal)
      console.log('==================================================\n')
    },
    debug: true
  })

  // Crear bot
  await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB
  })

  console.log('🤖 Bot iniciado correctamente y esperando conexión...')
}

// =====================
// START
// =====================
main()
