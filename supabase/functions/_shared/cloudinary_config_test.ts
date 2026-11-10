import { parseCloudinaryUrl } from "./cloudinary_config.ts";

Deno.test("parses a Cloudinary connection URL", () => {
  const config = parseCloudinaryUrl("cloudinary://123456:secret-value@sample-cloud");
  if (!config || config.cloudName !== "sample-cloud" || config.apiKey !== "123456" || config.apiSecret !== "secret-value") {
    throw new Error("Expected Cloudinary URL credentials to be parsed.");
  }
});

Deno.test("decodes URL-escaped credentials", () => {
  const config = parseCloudinaryUrl("cloudinary://api%40key:secret%2Fvalue@sample-cloud");
  if (!config || config.apiKey !== "api@key" || config.apiSecret !== "secret/value") {
    throw new Error("Expected percent-encoded credentials to be decoded.");
  }
});

Deno.test("rejects invalid or ambiguous Cloudinary URLs", () => {
  for (const value of ["", "https://sample-cloud", "cloudinary://@sample-cloud", "cloudinary://key:secret@sample-cloud/path", "cloudinary://key:secret@sample-cloud?x=1"]) {
    if (parseCloudinaryUrl(value) !== null) throw new Error(`Expected invalid URL to be rejected: ${value}`);
  }
});
