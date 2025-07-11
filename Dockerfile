# Usa una imagen base de Node.js
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de configuración y manifiesto de dependencias
COPY package*.json ./
COPY config.js ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Crea el directorio para las sesiones de WhatsApp y las imágenes
RUN mkdir -p .wwebjs_auth/Account1/Default .wwebjs_auth/Account2/Default imagenes

# Expone el puerto si tu aplicación tuviera un servidor web (aunque este script no lo tiene)
# EXPOSE 3000

# Comando para ejecutar la aplicación cuando se inicie el contenedor
# Usa "node tu_script_principal.js". Asumo que tu script principal se llama 'index.js' o similar.
# Si tu script principal se llama diferente (ej. 'app.js', 'main.js'), cámbialo aquí.
CMD ["node", "tu_script.js"] # <<-- ¡IMPORTANTE! Cambia 'app.js' por el nombre real de tu script