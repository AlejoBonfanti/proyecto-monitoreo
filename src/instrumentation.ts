/** Se ejecuta una vez al iniciar el servidor: valida la configuración antes de atender requests. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const produccion = process.env.NODE_ENV === "production";

  if (produccion && !process.env.SESSION_SECRET) {
    throw new Error("Falta SESSION_SECRET. Generala con `openssl rand -base64 32` y cargala en el entorno (ver .env.example).");
  }
  if (!process.env.API_URL?.trim()) {
    const msg = "[carnave] API_URL no está definida: se usan los datos simulados de src/mocks.";
    if (produccion) console.warn(`⚠ ${msg} No usar así en producción.`);
    else console.info(msg);
  }
}
