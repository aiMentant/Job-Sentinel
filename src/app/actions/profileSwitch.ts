"use server";

import { cookies } from "next/headers";

export async function getActiveProfileId(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const id = cookieStore.get("active_profile_id")?.value;
    return id || "default";
  } catch (error) {
    return "default";
  }
}

export async function setActiveProfileId(id: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set("active_profile_id", id, { maxAge: 2592000, path: "/" });
  } catch (error) {
    console.error("Failed to set active profile cookie:", error);
  }
  return id;
}
