"use client";
import { useEffect } from "react";

/** Tints the page background/hero gradient by the current AQI category (CSS variables on <html>). */
export function useAtmosphere(categoryId: string | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (categoryId) root.dataset.aqi = categoryId;
    else delete root.dataset.aqi;
    return () => {
      delete root.dataset.aqi;
    };
  }, [categoryId]);
}
