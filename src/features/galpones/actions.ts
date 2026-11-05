"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/features/auth/dal";
import { marcarDisponible } from "./api";

export async function marcarLimpiezaTerminada(galponId: number): Promise<void> {
  await requerirUsuario();
  await marcarDisponible(galponId);
  revalidatePath("/", "layout");
}
