"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/features/auth/dal";
import { reconocer, resolver } from "./api";

export async function reconocerAlerta(id: string): Promise<void> {
  await requerirUsuario();
  await reconocer(id);
  revalidatePath("/", "layout");
}

export async function resolverAlerta(id: string): Promise<void> {
  await requerirUsuario();
  await resolver(id);
  revalidatePath("/", "layout");
}
