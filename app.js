const fs = require("fs");
const xlsx = require("xlsx");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { DateTime } = require("luxon");
const readline = require("readline");
const config = require("./config");

// Crear interfaz de consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 1. Cargar el archivo Excel y listar hojas
let workbook;
try {
  workbook = xlsx.readFile(config.excelPath);
} catch (err) {
  console.error("❌ Error al leer el archivo Excel:", err.message);
  process.exit(1);
}

const sheetNames = workbook.SheetNames;
console.log("\n📄 Hojas disponibles en el archivo Excel:");
sheetNames.forEach((name, index) => {
  console.log(`${index + 1}. ${name}`);
});

// 2. Selección de hoja
rl.question(
  "\n📝 Ingrese el número de la hoja que desea usar: ",
  (sheetIndexInput) => {
    const sheetIndex = parseInt(sheetIndexInput.trim(), 10) - 1;

    if (
      isNaN(sheetIndex) ||
      sheetIndex < 0 ||
      sheetIndex >= sheetNames.length
    ) {
      console.error(
        "⚠️ Selección inválida. Ejecute de nuevo y elija un número válido."
      );
      process.exit(1);
    }

    const selectedSheetName = sheetNames[sheetIndex];
    const worksheet = workbook.Sheets[selectedSheetName];
    const contacts = xlsx.utils.sheet_to_json(worksheet);
    const totalContacts = contacts.length;

    console.log(`✅ Hoja seleccionada: "${selectedSheetName}"`);
    console.log(`✅ Contactos cargados: ${totalContacts}`);

    // 3. Mostrar imágenes disponibles
    const imageDir = "./imagenes";
    let imageOptions = [];

    try {
      imageOptions = fs
        .readdirSync(imageDir)
        .filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file));
    } catch (error) {
      console.warn(
        '⚠️ No se pudo acceder a la carpeta "imagenes". Solo se enviará texto.'
      );
    }

    console.log("\n🖼️ Imágenes disponibles para enviar:");
    console.log("0. ❌ No enviar imagen");
    imageOptions.forEach((img, idx) => {
      console.log(`${idx + 1}. ${img}`);
    });

    rl.question(
      "\n📸 Ingrese el número de la imagen a enviar (o 0 para solo texto): ",
      (imgChoice) => {
        const selectedIndex = parseInt(imgChoice.trim(), 10);
        let selectedImage = null;

        if (
          !isNaN(selectedIndex) &&
          selectedIndex > 0 &&
          selectedIndex <= imageOptions.length
        ) {
          selectedImage = `${imageDir}/${imageOptions[selectedIndex - 1]}`;
          console.log(
            `✅ Imagen seleccionada: ${imageOptions[selectedIndex - 1]}`
          );
        } else if (selectedIndex === 0) {
          console.log("✅ Envío de solo texto seleccionado.");
        } else {
          console.log(
            "⚠️ Opción inválida. Envío de texto sin imagen por defecto."
          );
        }

        // 4. Ingresar mensaje personalizado
        rl.question(
          "\n✉️ Ingrese el mensaje que desea enviar: ",
          (userMessage) => {
            if (!userMessage.trim()) {
              console.error("⚠️ El mensaje no puede estar vacío.");
              process.exit(1);
            }

            // 5. Elegir cuenta
            rl.question(
              "\n📱 Seleccione la cuenta de WhatsApp para enviar (1 o 2): ",
              (choice) => {
                const account = choice.trim();
                if (account !== "1" && account !== "2") {
                  console.log(
                    '⚠️ Opción inválida. Ejecute de nuevo y elija "1" o "2".'
                  );
                  process.exit(1);
                }

                rl.question(
                  `\n🚀 Se enviará el mensaje a ${totalContacts} contactos desde la Cuenta ${account}. ¿Desea proceder? (s/n): `,
                  async (confirm) => {
                    rl.close();
                    if (confirm.toLowerCase() !== "s") {
                      console.log("❌ Envío cancelado por el usuario.");
                      process.exit(0);
                    }

                    const authFolder = `.wwebjs_auth/Account${account}`;
                    const sessionFile = `${authFolder}/Default/session.json`;
                    const sessionExists = fs.existsSync(sessionFile);

                    if (sessionExists) {
                      console.log(
                        `✅ Sesión encontrada para Cuenta ${account}. No se requiere escanear QR.`
                      );
                    } else {
                      console.log(
                        `📷 No hay sesión previa para Cuenta ${account}. Se pedirá escanear QR.`
                      );
                    }

                    const client = new Client({
                      authStrategy: new LocalAuth({
                        clientId: `Account${account}`,
                      }),
                    });

                    client.on("qr", (qr) => {
                      if (!sessionExists) {
                        console.log(
                          "\n🔒 Escanee este código QR con WhatsApp:"
                        );
                        qrcode.generate(qr, { small: true });
                      }
                    });

                    client.on("ready", async () => {
                      console.log(
                        "\n✅ Cliente WhatsApp listo. Comenzando envío de mensajes...\n"
                      );

                      for (let i = 0; i < contacts.length; i++) {
                        const contact = contacts[i];
                        const rawNumber = String(contact["Celular"]).replace(
                          /[^0-9+]/g,
                          ""
                        );
                        const number = rawNumber.startsWith("+")
                          ? rawNumber.slice(1)
                          : rawNumber;

                        let numberId;
                        try {
                          numberId = await client.getNumberId(number);
                        } catch (error) {
                          console.error(
                            `❌ (${
                              i + 1
                            }) Error verificando número ${number}: ${
                              error.message
                            }`
                          );
                          continue;
                        }

                        if (!numberId) {
                          console.log(
                            `❌ (${
                              i + 1
                            }) El número ${number} no tiene WhatsApp.`
                          );
                          continue;
                        }

                        try {
                          // Obtener nombre del contacto o "Mi estimado/a"
                          const name =
                            contact["Contacto principal"] &&
                            contact["Contacto principal"].trim()
                              ? contact["Contacto principal"]
                              : "Mi estimado/a";

                          // Reemplazar plantilla con nombre personalizado
                          const personalizedMessage = userMessage.replace(
                            "{Contacto principal}",
                            name
                          );

                          if (selectedImage) {
                            const media =
                              MessageMedia.fromFilePath(selectedImage);
                            await client.sendMessage(
                              numberId._serialized,
                              media,
                              {
                                caption: personalizedMessage,
                              }
                            );
                          } else {
                            await client.sendMessage(
                              numberId._serialized,
                              personalizedMessage
                            );
                          }

                          console.log(
                            `✅ (${
                              i + 1
                            }) Mensaje enviado a ${name} (${number})`
                          );

                          const now = DateTime.now().toFormat(
                            config.timeFormat
                          );
                        } catch (error) {
                          console.error(
                            `❌ (${i + 1}) Error enviando a ${number}: ${
                              error.message
                            }`
                          );
                        }

                        if (i < contacts.length - 1) {
                          const delay =
                            Math.floor(
                              Math.random() *
                                (config.delayMax - config.delayMin + 1)
                            ) + config.delayMin;
                          await new Promise((res) => setTimeout(res, delay));
                        }
                      }

                      console.log("\n🏁 Proceso de envío finalizado.");
                      process.exit(0);
                    });

                    client.on("auth_failure", (msg) => {
                      console.error("❌ Fallo de autenticación:", msg);
                      process.exit(1);
                    });

                    client.on("disconnected", (reason) => {
                      console.warn("⚠️ Cliente desconectado:", reason);
                      process.exit(1);
                    });

                    client.initialize();
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);
