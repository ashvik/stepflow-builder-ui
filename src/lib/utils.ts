import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix: string = "node"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

export function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}