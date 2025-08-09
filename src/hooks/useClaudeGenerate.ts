import { supabase } from "@/integrations/supabase/client";

export type DynamicElement = {
  key: string;
  label: string;
  original: string;
  ai: string;
  enabled: boolean;
};

export async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const mime = file.type || "image/png";
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = (reader.result as string) || "";
      const b64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64, mime };
}

export async function generateDynamicMapping(params: {
  productUrl: string;
  creativeFile?: File | null;
  creativeBase64?: string;
  creativeMime?: string;
  language?: string;
  brand?: string;
  desiredElements?: string[];
}): Promise<DynamicElement[]> {
  const { productUrl, creativeFile, creativeBase64, creativeMime, language = "fr", brand, desiredElements } = params;

  let payload: any = {
    product_url: productUrl,
    language,
  };

  if (brand) payload.brand = brand;
  if (desiredElements) payload.desired_elements = desiredElements;

  if (creativeFile) {
    const { base64, mime } = await fileToBase64(creativeFile);
    payload.creative_base64 = base64;
    payload.creative_mime = mime;
  } else if (creativeBase64) {
    payload.creative_base64 = creativeBase64;
    payload.creative_mime = creativeMime || "image/png";
  }

  const { data, error } = await supabase.functions.invoke("claude-generate", {
    body: payload,
  });

  if (error) {
    console.error("claude-generate error", error);
    throw new Error(error.message || "Edge function error");
  }

  const elements = (data?.elements || []) as DynamicElement[];
  return elements;
}
