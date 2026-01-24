import type { Request, Response, NextFunction } from "express";
import jwksRsa from "jwks-rsa";
import jwt, { JwtHeader } from "jsonwebtoken";

const projectId = process.env.FIREBASE_PROJECT_ID || "fideprepweb";
const audience = projectId;
const issuer = `https://securetoken.google.com/${projectId}`;

const client = jwksRsa({
  jwksUri:
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

async function getKey(header: JwtHeader): Promise<string> {
  if (!header.kid) throw new Error("No 'kid' in token header");
  const key = await client.getSigningKey(header.kid);
  const signingKey = key.getPublicKey();
  return signingKey;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers["authorization"] || req.headers["Authorization"]; // node types
    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const parts = auth.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Invalid Authorization format" });
    }

    const token = parts[1];

    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(
        token,
        async (header, callback) => {
          try {
            const key = await getKey(header as JwtHeader);
            callback(null, key);
          } catch (e) {
            callback(e as Error);
          }
        },
        {
          algorithms: ["RS256"],
          audience: audience || projectId,
          issuer,
        },
        (err, payload) => {
          if (err) return reject(err);
          resolve(payload);
        }
      );
    });

    // Attach to request
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Unauthorized", message: err?.message });
  }
}
