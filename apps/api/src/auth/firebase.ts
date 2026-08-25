import { createRemoteJWKSet, jwtVerify } from "jose";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "nmfc-prod";

const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type AuthUser = {
  uid: string;
  email: string;
};

export async function verifyFirebaseIdToken(authorization: string | undefined): Promise<AuthUser> {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    throw Object.assign(new Error("Sign in required."), { statusCode: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const uid = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!uid || !email) {
      throw new Error("Token missing email.");
    }

    return { uid, email };
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) throw err;
    throw Object.assign(new Error("Invalid or expired session. Sign in again."), { statusCode: 401 });
  }
}
