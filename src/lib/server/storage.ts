// Object storage for receipt images. S3-compatible: the same code targets MinIO
// (local dev — docker-compose) and Cloudflare R2 / AWS S3 in production; only the
// S3_* env vars change. Server-only. The bucket is PRIVATE — receipts are viewed
// through short-lived presigned GET URLs (presignedReceiptUrl), never public.
import process from "node:process";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.S3_BUCKET ?? "receipts";

const s3 = new S3Client({
	region: process.env.S3_REGION ?? "auto",
	endpoint: process.env.S3_ENDPOINT, // MinIO http://localhost:9000 / R2 endpoint
	forcePathStyle: true, // MinIO needs path-style; R2/S3 accept it too
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
	},
});

// Map a MIME type to a file extension for tidy keys.
const EXT: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/heic": "heic",
	"image/heif": "heif",
	"application/pdf": "pdf",
};

/** Object key for a receipt, namespaced by branch + expense. */
export function receiptKeyFor(
	branchId: string,
	expenseId: string,
	contentType: string,
): string {
	return `receipts/${branchId}/${expenseId}.${EXT[contentType] ?? "bin"}`;
}

/** Upload receipt bytes under `key` (overwrites if it exists). */
export async function putReceipt(
	key: string,
	bytes: Uint8Array,
	contentType: string,
): Promise<void> {
	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: bytes,
			ContentType: contentType,
		}),
	);
}

/** Fetch the raw bytes + content type for `key` (used by OCR). Null on failure. */
export async function getReceiptBytes(
	key: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
	try {
		const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
		if (!res.Body) return null;
		const bytes = Buffer.from(await res.Body.transformToByteArray());
		return {
			bytes,
			contentType: res.ContentType ?? "application/octet-stream",
		};
	} catch (err) {
		console.error("S3 getReceiptBytes failed", key, err);
		return null;
	}
}

/** A short-lived presigned GET URL to view a receipt from the private bucket. */
export function presignedReceiptUrl(
	key: string,
	expiresInSeconds = 300,
): Promise<string> {
	return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
		expiresIn: expiresInSeconds,
	});
}
